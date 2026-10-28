// Manual refresh feedback only; background synchronisation remains unobtrusive.
export function bindRefreshFeedback({button,dialog,refresh,notify,minimumMs=1800,timeoutMs=15000}) {
 let running=false;
 dialog.addEventListener('cancel',event=>event.preventDefault());
 button.addEventListener('click',async event=>{
  if(running)return;
  running=true;
  const pointer=event.detail>0,controller=new AbortController();
  const minimum=new Promise(resolve=>setTimeout(resolve,minimumMs));
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  button.disabled=true;button.setAttribute('aria-busy','true');
  button.setAttribute('aria-label','Refreshing shared records');
  let message;
  try {
   dialog.showModal();
   await refresh(controller.signal);
   message='Tracker refreshed.';
  } catch(error) {
   message=controller.signal.aborted?'Refresh timed out. Please try again.':error.message||'Could not refresh. Please try again.';
  } finally {
   clearTimeout(timeout);
   await minimum;
   button.disabled=false;button.removeAttribute('aria-busy');
   button.setAttribute('aria-label','Refresh shared records');
   if(dialog.open)dialog.close();
   if(pointer)button.blur();else button.focus({preventScroll:true});
   running=false;
  }
  notify(message);
 });
}
