export function collisionInsets(values={},margin=12){
  return Object.fromEntries(['top','right','bottom','left'].map(side=>[side,Math.max(margin,Number.parseFloat(values[side])||0)]));
}
