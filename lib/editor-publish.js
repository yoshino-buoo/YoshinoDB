import {
  materialize,
  entryIssues,
  validateEditorCatalog,
} from "./editor-data.js";
import { recordImages, validateCatalog } from "./data.js";

export const REPOSITORY = "yoshino-buoo/YoshinoDB";
export const REPOSITORY_URL = `https://github.com/${REPOSITORY}`;
const stringify = (value) => JSON.stringify(value, null, 2) + "\n";
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function changedRecords(before, after) {
  const old = new Map(before.items.map((x) => [x.id, x]));
  const next = new Map(after.items.map((x) => [x.id, x]));
  return [...new Set([...old.keys(), ...next.keys()])]
    .filter((id) => !same(old.get(id), next.get(id)))
    .map((id) => ({
      id,
      before: old.get(id),
      after: next.get(id),
      action: !next.has(id) ? "delete" : old.has(id) ? "edit" : "add",
    }));
}

export function changedFields(before, after, path = "") {
  if (same(before, after)) return [];
  const object = (x) => x && typeof x === "object" && !Array.isArray(x);
  if (object(before) && object(after))
    return [
      ...new Set([...Object.keys(before), ...Object.keys(after)]),
    ].flatMap((key) =>
      changedFields(before[key], after[key], path ? `${path}.${key}` : key),
    );
  return [{ path, before, after }];
}

export class PublicationError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.code = code;
    Object.assign(this, details);
  }
}

// Credentials are captured only in this short-lived object. Never store them in
// drafts, URLs, ZIPs, errors or commits. Only api.github.com receives the token.
export function githubPublisher(
  token,
  { request = fetch, onProgress = () => {}, onAttempt = () => {} } = {},
) {
  let submission, reservedBranch;
  const saveAttempt = () =>
    onAttempt({
      branch: submission.branch,
      baseSha: submission.review.baseSha,
      commitSha: submission.commitSha,
      imageCount: submission.review.imageCount,
    });
  async function api(path, method = "GET", body, raw = false) {
    let response;
    try {
      response = await request(
        `https://api.github.com/repos/${REPOSITORY}${path}`,
        {
          method,
          headers: {
            Accept: raw
              ? "application/vnd.github.raw+json"
              : "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "X-GitHub-Api-Version": "2022-11-28",
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
          signal: AbortSignal.timeout(30000),
          credentials: "omit",
          redirect: "error",
        },
      );
    } catch {
      throw new PublicationError("network", { branch: submission?.branch });
    }
    if (!response.ok)
      throw new PublicationError(
        response.status === 401
          ? "authentication"
          : response.status === 403
            ? "permission"
            : "github",
        { status: response.status, branch: submission?.branch },
      );
    return response.status === 204 ? null : response.json();
  }
  const head = async () => (await api("/git/ref/heads/main")).object.sha;
  const file = (path, sha) =>
    api(
      `/contents/${path}?ref=${encodeURIComponent(sha)}`,
      "GET",
      undefined,
      true,
    );
  const pullRequests = (branch) =>
    api(
      `/pulls?state=all&head=${encodeURIComponent(REPOSITORY.split("/")[0] + ":" + branch)}`,
    );
  const publicPR = (pr, branch) => {
    if (!pr.html_url?.startsWith(`${REPOSITORY_URL}/pull/`))
      throw new PublicationError("github");
    return { url: pr.html_url, number: pr.number, branch };
  };
  return {
    async recover(attempt) {
      if (!/^codex\/content-[a-f0-9-]{36}$/.test(attempt?.branch || ""))
        throw new PublicationError("branch");
      const existing = await pullRequests(attempt.branch);
      if (existing[0]) return { pr: publicPR(existing[0], attempt.branch) };
      let ref;
      try {
        ref = await api(`/git/ref/heads/${attempt.branch}`);
      } catch (error) {
        if (error.status !== 404) throw error;
      }
      const commitSha = ref?.object.sha || attempt.commitSha;
      if (!commitSha) {
        reservedBranch = attempt.branch;
        return null;
      }
      if (attempt.commitSha && commitSha !== attempt.commitSha)
        throw new PublicationError("branch");
      const [remote, catalog] = await Promise.all([
        file("public/data/catalog.json", attempt.baseSha),
        file("public/data/catalog.json", commitSha),
      ]);
      validateCatalog(remote);
      validateEditorCatalog(catalog);
      const review = {
        baseSha: attempt.baseSha,
        remote,
        catalog,
        changed: changedRecords(remote, catalog),
        imageCount: attempt.imageCount || 0,
        recovered: true,
      };
      submission = {
        branch: attempt.branch,
        commitSha,
        branchCreated: !!ref,
        review,
      };
      return { review };
    },
    async review(changes, pendingImages = []) {
      onProgress("reading");
      const baseSha = await head();
      const [commit, remote, generated] = await Promise.all([
        api(`/git/commits/${baseSha}`),
        file("public/data/catalog.json", baseSha),
        file("public/data/generated.json", baseSha),
      ]);
      validateCatalog(remote);
      validateCatalog(generated);
      const result = materialize(remote, changes);
      if (result.conflicts.length)
        throw new PublicationError("conflict", {
          catalog: remote,
          conflicts: result.conflicts,
        });
      const ids = new Set(
        [...result.catalog.items, ...generated.items].map((x) => x.id),
      );
      const issues = result.catalog.items.flatMap((x) =>
        entryIssues(x, ids, true),
      );
      if (issues.length) throw new PublicationError("validation", { issues });
      validateEditorCatalog(result.catalog);
      const changed = changedRecords(remote, result.catalog);
      if (!changed.length)
        throw new PublicationError("unchanged", { catalog: remote });
      result.catalog.updatedAt = new Date().toISOString().slice(0, 10);
      const files = { "public/data/catalog.json": stringify(result.catalog) };
      const used = new Set(
        result.catalog.items.flatMap((x) =>
          recordImages(x).map((art) => art.image),
        ),
      );
      const known = new Set(
        remote.items.flatMap((x) => recordImages(x).map((art) => art.image)),
      );
      const addedImages = pendingImages.filter(
        (art) => used.has(art.path) && !known.has(art.path),
      );
      if (addedImages.length) {
        const manifest = await file("public/assets/manifest.json", baseSha);
        if (!Array.isArray(manifest)) throw new PublicationError("manifest");
        for (const art of addedImages) {
          if (
            !/^assets\/upload-[a-z0-9-]+\.(png|jpg|jpeg|webp|gif)$/.test(
              art.path,
            ) ||
            art.blob.size > 8_000_000
          )
            throw new PublicationError("image");
          files[`public/${art.path}`] = new Uint8Array(
            await art.blob.arrayBuffer(),
          );
          const item = result.catalog.items.find((x) =>
            recordImages(x).some((a) => a.image === art.path),
          );
          const info = recordImages(item).find((a) => a.image === art.path);
          if (!manifest.some((a) => a.image === art.path))
            manifest.push({
              image: art.path,
              imageSource: info.imageSource || "",
              source: info.source || item.source,
            });
        }
        files["public/assets/manifest.json"] = stringify(manifest);
      }
      // Validate every new file path against the exact reviewed commit, not the
      // potentially stale Pages deployment. Missing images never reach a PR.
      const unknown = [...used].filter(
        (path) => path && !known.has(path) && !files[`public/${path}`],
      );
      for (const path of unknown)
        await api(
          `/contents/public/${path}?ref=${encodeURIComponent(baseSha)}`,
        );
      return {
        baseSha,
        treeSha: commit.tree.sha,
        remote,
        catalog: result.catalog,
        changed,
        files,
        imageCount: addedImages.length,
      };
    },
    async submit(review, title) {
      if (!submission) {
        if ((await head()) !== review.baseSha)
          throw new PublicationError("stale");
        submission = {
          branch: reservedBranch || `codex/content-${crypto.randomUUID()}`,
          review,
        };
        saveAttempt();
      }
      if (submission.review !== review) throw new PublicationError("stale");
      onProgress("uploading");
      if (!submission.commitSha) {
        const tree = [];
        for (const [path, value] of Object.entries(review.files)) {
          const binary = value instanceof Uint8Array;
          let content = value;
          if (binary) {
            let text = "";
            for (let i = 0; i < value.length; i += 8192)
              text += String.fromCharCode(...value.subarray(i, i + 8192));
            content = btoa(text);
          }
          const blob = await api("/git/blobs", "POST", {
            content,
            encoding: binary ? "base64" : "utf-8",
          });
          tree.push({ path, mode: "100644", type: "blob", sha: blob.sha });
        }
        const result = await api("/git/trees", "POST", {
          base_tree: review.treeSha,
          tree,
        });
        const commit = await api("/git/commits", "POST", {
          message: title.trim() || "Update archive content",
          tree: result.sha,
          parents: [review.baseSha],
        });
        submission.commitSha = commit.sha;
        saveAttempt();
      }
      if (!submission.branchCreated) {
        // On an uncertain POST result, retry by reading our unique branch first.
        let existing;
        try {
          existing = await api(`/git/ref/heads/${submission.branch}`);
        } catch (error) {
          if (error.status !== 404) throw error;
        }
        if (existing && existing.object.sha !== submission.commitSha)
          throw new PublicationError("branch");
        if (!existing)
          await api("/git/refs", "POST", {
            ref: `refs/heads/${submission.branch}`,
            sha: submission.commitSha,
          });
        submission.branchCreated = true;
      }
      onProgress("creating");
      const existing = await pullRequests(submission.branch);
      const pr =
        existing[0] ||
        (await api("/pulls", "POST", {
          title: title.trim() || "Update archive content",
          head: submission.branch,
          base: "main",
          body: `Content edited and previewed in YoshinoDB.\n\n${review.changed.length} records changed; ${review.imageCount} new images.\n\n${review.changed.map((x) => `- ${x.action}: ${x.id}`).join("\n")}\n\nThe content checks must pass before merging. Merging into main triggers the existing Pages deployment.`,
        }));
      return publicPR(pr, submission.branch);
    },
  };
}
