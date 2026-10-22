// Convert the existing declarative options, not their values or business rules.
// Rich desktop labels become readable native labels; group/disabled semantics stay.
export function selectText(node){
  if(node==null||typeof node==='boolean')return '';
  if(typeof node==='string'||typeof node==='number')return String(node);
  if(Array.isArray(node))return node.map(selectText).join('');
  return selectText(node.props?.children);
}
export function nativeSelectModel(children,{itemType,groupType,labelType,valueType}){
  const options=[];let placeholder='';
  function walk(node,group='',disabled=false){
    if(Array.isArray(node)){node.forEach(child=>walk(child,group,disabled));return;}
    if(!node?.props)return;
    if(node.type===valueType)placeholder=node.props.placeholder||placeholder;
    if(node.type===itemType){
      const label=String(node.props.textValue??selectText(node.props.children)).replace(/\s+/g,' ').trim();
      options.push({value:String(node.props.value),label,group,disabled:disabled||!!node.props.disabled});return;
    }
    if(node.type===groupType){
      const list=[node.props.children].flat(Infinity);
      const label=list.find(child=>child?.type===labelType);
      group=selectText(label?.props.children).trim();disabled=disabled||!!node.props.disabled;
    }
    walk(node.props.children,group,disabled);
  }
  walk(children);
  return {options,placeholder};
}

