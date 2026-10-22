export function focusableWorkspaceControls(root){
  return [...root.querySelectorAll('button,a[href],input,textarea,select,[tabindex]')].filter(node=>
    !node.disabled&&node.tabIndex>=0&&node.getClientRects().length&&!node.closest('[hidden],[inert],[aria-hidden="true"]'));
}
export function topmostDismissibleLayer(doc){
  const layers=[...doc.querySelectorAll('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="listbox"][data-state="open"], [role="menu"][data-state="open"]')]
    .filter(node=>node.getClientRects().length&&!node.closest('[hidden],[inert]'));
  return [...layers].reverse().find(node=>node.contains(doc.activeElement))||layers.at(-1)||null;
}
