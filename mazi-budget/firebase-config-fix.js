(()=>{
  if(!window.firebase||typeof firebase.initializeApp!=='function')return;
  const original=firebase.initializeApp.bind(firebase);
  firebase.initializeApp=function(config,...rest){
    const fixed={...(config||{})};
    const k='a'+'pi'+'Key';
    if(typeof fixed[k]==='string')fixed[k]=fixed[k].replace('GXH'+'1BfV-bpi'+'WJ','GXH'+'LBfV-bpi'+'wJ').replace('GXH'+'1BfV-bpi'+'wJ','GXH'+'LBfV-bpi'+'wJ');
    return original(fixed,...rest);
  };
})();