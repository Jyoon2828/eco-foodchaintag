// These are Firebase web-app settings, never a service-account private key.
export default function handler(req,res){
  let config={};
  try{config=JSON.parse(process.env.FIREBASE_WEB_CONFIG||'{}');}catch{res.status(500).json({error:'FIREBASE_WEB_CONFIG의 JSON 형식을 확인하세요.'});return;}
  res.setHeader('Cache-Control','no-store');
  res.status(200).json({firebase:config});
}
