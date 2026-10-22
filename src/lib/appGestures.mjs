export function suppressChromeGesture(target){
  if(!target?.closest)return false;
  if(target.closest('input,textarea,[contenteditable="true"],[data-selectable="true"],.taxea-selectable,[data-native-gestures]'))return false;
  return !!target.closest('button,[role="button"],nav,[data-app-chrome],img[data-decorative]');
}

