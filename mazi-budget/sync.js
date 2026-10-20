(()=>{
const OLD_KEYS=[
  'mazi-sync-secret-v1',
  'mazi-sync-actor-v1',
  'mazi-sync-device-v1',
  'mazi-sync-version-v1',
  'mazi-sync-bound-v1',
  'mazi-sync-dirty-v1',
  'mazi-sync-conflict-backup'
];

function removeLegacySync(){
  for(const k of OLD_KEYS)localStorage.removeItem(k);
}

function setLocalStatus(){
  const b=document.getElementById('syncStatusButton');
  const t=document.getElementById('syncStatusText');
  if(b){
    b.dataset.state='';
    b.disabled=true;
    b.title='Ο παλιός συγχρονισμός με κοινό κωδικό έχει καταργηθεί. Η εφαρμογή λειτουργεί τοπικά μέχρι να συνδεθεί το νέο login με email.';
  }
  if(t)t.textContent='Τοπικά';
}

removeLegacySync();

window.maziSyncChanged=()=>{};
window.initMaziSync=()=>{
  removeLegacySync();
  setLocalStatus();
};
})();