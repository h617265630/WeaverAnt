(() => {
  const script=document.currentScript,parentOrigin=script.dataset.wbParent,source=script.dataset.wbSource;
  if(window.parent===window)return;
  let enabled=false,hovered=null;
  const box=document.createElement('div');box.setAttribute('data-wb-overlay','');Object.assign(box.style,{position:'fixed',pointerEvents:'none',border:'2px solid #618b72',background:'#618b7212',borderRadius:'5px',zIndex:'2147483647',display:'none',boxSizing:'border-box'});document.documentElement.append(box);
  const send=message=>window.parent.postMessage({source:'wb-preview',...message},parentOrigin);
  const selector=element=>{if(element.dataset.aiId)return `[data-ai-id="${CSS.escape(element.dataset.aiId)}"]`;if(element.id)return `#${CSS.escape(element.id)}`;const parts=[];for(let node=element;node&&node!==document.body&&parts.length<5;node=node.parentElement){const siblings=[...node.parentElement.children].filter(x=>x.tagName===node.tagName);parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(node)+1})`);}return parts.join(' > ');};
  window.addEventListener('message',event=>{if(event.source!==window.parent||event.origin!==parentOrigin||event.data?.source!=='wb-host')return;if(event.data.type==='pick-mode'){enabled=!!event.data.enabled;document.documentElement.style.cursor=enabled?'crosshair':'';if(!enabled)box.style.display='none';}});
  document.addEventListener('pointermove',event=>{if(!enabled||event.target.closest('[data-wb-overlay]'))return;hovered=event.target;const r=hovered.getBoundingClientRect();Object.assign(box.style,{display:'block',left:`${r.left}px`,top:`${r.top}px`,width:`${r.width}px`,height:`${r.height}px`});},true);
  document.addEventListener('click',event=>{
    if(!enabled)return;event.preventDefault();event.stopImmediatePropagation();
    const element=event.target,rect=element.getBoundingClientRect(),css=selector(element);
    const clone=element.cloneNode(true);for(const input of clone.querySelectorAll?.('input,textarea')||[]) {input.removeAttribute('value');input.textContent='';}if(clone.matches?.('input,textarea')){clone.removeAttribute('value');clone.textContent='';}
    send({type:'selection',anchor:{key:`${source}::${element.dataset.aiId||css}`,label:(element.getAttribute('aria-label')||element.textContent||element.tagName).trim().slice(0,60),selector:css,sourceFile:element.closest('[data-ai-source]')?.dataset.aiSource||source,text:(element.textContent||'').trim().slice(0,1500),html:clone.outerHTML.slice(0,4000),rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}}});
    enabled=false;box.style.display='none';document.documentElement.style.cursor='';
  },true);
  window.addEventListener('keydown',event=>{if(event.key==='Escape'){enabled=false;box.style.display='none';send({type:'pick-cancelled'});}});
  send({type:'ready'});
})();
