// Every track plays once per shuffled round. A round boundary never repeats
// the song that just ended; pausing or changing routes does not consume a song.
export function createShuffleCycle(items, random = Math.random) {
  if (!items.length) throw new Error("A playlist needs at least one track");
  let queue = [], previous;
  return () => {
    if (!queue.length) {
      queue = [...items];
      for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]];
      }
      if (queue.length > 1 && queue[0] === previous) {
        const j = 1 + Math.floor(random() * (queue.length - 1));
        [queue[0], queue[j]] = [queue[j], queue[0]];
      }
    }
    previous = queue.shift();
    return previous;
  };
}
