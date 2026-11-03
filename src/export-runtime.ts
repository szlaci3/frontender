// Only this application-owned code runs in a preview/export. Imported scripts never run.
export const interactionRuntime = `
document.querySelectorAll('.board-section').forEach(board=>{
  let dragged=null;
  const columns=[...board.querySelectorAll('.board-column')];
  const update=()=>columns.forEach(col=>{const count=col.querySelector('.column-count');if(count)count.textContent=String(col.querySelectorAll('.kanban-card').length)});
  columns.forEach((col,index)=>{
    col.addEventListener('dragover',event=>event.preventDefault());
    col.addEventListener('drop',event=>{event.preventDefault();if(dragged){col.append(dragged);const move=dragged.querySelector('[data-move-card]');if(move)move.value=String(index);update()}});
    col.querySelectorAll('.kanban-card').forEach(card=>{
      card.draggable=true;card.addEventListener('dragstart',()=>{dragged=card});card.addEventListener('dragend',()=>{dragged=null});
      const select=document.createElement('select');select.dataset.moveCard='true';select.setAttribute('aria-label','Move card '+(card.querySelector('h3')?.textContent||''));
      columns.forEach((target,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent='Move to '+(target.querySelector('h3')?.textContent||'column '+(i+1));select.append(option)});
      select.value=String(index);select.addEventListener('change',()=>{columns[Number(select.value)].append(card);update()});card.append(select);
    });
  });
});
document.querySelectorAll('table').forEach(table=>{
  table.querySelectorAll('thead th').forEach((th,index)=>{
    th.tabIndex=0;th.setAttribute('aria-sort','none');th.title='Sort this column';
    const sort=()=>{const descending=th.getAttribute('aria-sort')==='ascending';const body=table.tBodies[0];if(!body)return;const rows=[...body.rows];rows.sort((a,b)=>(a.cells[index]?.textContent||'').localeCompare(b.cells[index]?.textContent||'',undefined,{numeric:true})*(descending?-1:1));rows.forEach(row=>body.append(row));table.querySelectorAll('thead th').forEach(h=>h.setAttribute('aria-sort','none'));th.setAttribute('aria-sort',descending?'descending':'ascending')};
    th.addEventListener('click',sort);th.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();sort()}});
  });
});
`;
