import {organismPicture} from './quiz-view.js';
import {drawOrganismImage} from './render.js';
import {webName} from './food-web.js';

const webSprites={mouse:new Image(),sparrow:new Image()};
webSprites.mouse.src='./assets/mouse.png';webSprites.sparrow.src='./assets/sparrow.png';
export function installWebArtwork(){
  for(const id of Object.keys(webSprites))document.documentElement.style.setProperty('--web-'+id+'-image',`url("${webSprites[id].src}")`);
}
export function webPicture(id){
  return webSprites[id]?`<i class="web-new-animal web-image-${id}" aria-hidden="true"></i><b>${webName(id)}</b>`:organismPicture(id);
}
export function drawWebPicture(c,id,x,y,size){
  const img=webSprites[id];
  if(!img)return drawOrganismImage(c,id,x,y,size);
  if(!img.complete||!img.naturalWidth)return false;
  c.drawImage(img,x-size/2,y-size/2,size,size);return true;
}
