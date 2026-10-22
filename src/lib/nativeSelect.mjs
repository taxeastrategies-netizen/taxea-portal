// Convert the existing declarative options, not their values or business rules.
// Rich desktop labels become readable native labels; group/disabled semantics stay.
export function selectText(node){
  if(node==null||typeof node==='boolean')return '';
  if(typeof node==='string'||typeof node==='number')return String(node);
  if(Array.isArray(node))return node.map(selectText).join('');
  return selectText(node.props?.children);
}
export function nativeSelectModel(children,{itemType,groupType,labelType,valueType,triggerType}){
  const options=[];let placeholder='',triggerLabel='';
  function walk(node,group='',disabled=false){
    if(Array.isArray(node)){node.forEach(child=>walk(child,group,disabled));return;}
    if(!node?.props)return;
    if(node.type===valueType)placeholder=node.props.placeholder||placeholder;
    if(triggerType&&node.type===triggerType)triggerLabel=node.props['aria-label']||triggerLabel;
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
  return {options,placeholder:placeholder||triggerLabel};
}
export function filterPickerOptions(options,query){
  const normalize=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
  const search=normalize(query).trim();
  return search?options.filter(option=>normalize(option.label+' '+option.group+' '+option.value).includes(search)):options;
}
export function resetUncontrolledSelect(defaultValue,triggerRef,setValue){
  // The browser's native reset runs after the reset event. Restore afterwards,
  // including when React would otherwise bail out because its state is equal.
  return Promise.resolve().then(()=>{
    const trigger=triggerRef.current;if(!trigger)return;
    const value=defaultValue??'';
    if(trigger.tagName==='SELECT')trigger.value=String(value);
    setValue(value);
  });
}
export function syncNativeSelectDefaults(control,defaultValue,currentValue){
  if(control?.tagName!=='SELECT')return;
  const resetValue=String(defaultValue??'');
  for(const option of control.options)option.defaultSelected=option.value===resetValue;
  // Setting defaultSelected can affect a pristine select. Keep the displayed
  // value controlled, while native form.reset() has the correct default.
  control.value=String(currentValue??'');
}

