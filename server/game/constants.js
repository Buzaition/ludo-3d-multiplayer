export const COLORS = ['RED', 'GREEN', 'YELLOW', 'BLUE'];

export const BASE_PATH = [
  [6,0],[6,1],[6,2],[6,3],[6,4],[6,5],
  [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],
  [1,8],[2,8],[3,8],[4,8],[5,8],
  [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],
  [8,14],[8,13],[8,12],[8,11],[8,10],[8,9],
  [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],
  [13,6],[12,6],[11,6],[10,6],[9,6],
  [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0]
];

// Direction locked from the approved local prototype.
export const PATH = [...BASE_PATH].reverse();

export const START_CELL = {
  RED: [1,6],
  GREEN: [6,13],
  YELLOW: [13,8],
  BLUE: [8,1]
};

export const FINISH_LANES = {
  RED: [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  GREEN: [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
  YELLOW: [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],
  BLUE: [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]]
};

export const START_INDEX = Object.fromEntries(
  COLORS.map(color => [
    color,
    PATH.findIndex(([r, c]) => r === START_CELL[color][0] && c === START_CELL[color][1])
  ])
);

export const SAFE_CELLS = [
  ...COLORS.map(color => START_CELL[color]),
  ...COLORS.map(color => PATH[(START_INDEX[color] + 8) % PATH.length])
];

export const VISUAL_SAFE_CELLS = COLORS.map(
  color => PATH[(START_INDEX[color] + 8) % PATH.length]
);

export const SAFE_CELL_KEYS = new Set(SAFE_CELLS.map(([r, c]) => `${r},${c}`));

export const MAIN_TRACK_LAST_PROGRESS = 50;
export const FINISH_LANE_START_PROGRESS = 51;
export const FINAL_PROGRESS = 56;

export function cellKey(cell) {
  return cell ? `${cell[0]},${cell[1]}` : null;
}

export function cellForProgress(color, progress) {
  if (progress < 0 || progress > FINAL_PROGRESS) return null;
  if (progress <= MAIN_TRACK_LAST_PROGRESS) {
    return PATH[(START_INDEX[color] + progress) % PATH.length];
  }
  const laneIndex = Math.min(5, progress - FINISH_LANE_START_PROGRESS);
  return FINISH_LANES[color][laneIndex];
}
