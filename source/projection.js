import {W,H} from './engine.js';
export const MAP_MARGIN=100;
export const MAP_WIDTH=W+MAP_MARGIN*2;
export const MAP_HEIGHT=H+MAP_MARGIN*2;
export function project(x,y,z=0){return {x:x+MAP_MARGIN,y:y+MAP_MARGIN-z};}
export function unproject(x,y){return {x:x-MAP_MARGIN,y:y-MAP_MARGIN};}
export function screenVectorToWorld(x,y){const n=Math.max(1,Math.hypot(x,y));return {x:x/n,y:y/n};}
// Columns in the atlas: front, left, right, back.
export function facingFrame(angle){const x=Math.cos(angle),y=Math.sin(angle);return Math.abs(x)>Math.abs(y)?(x<0?1:2):(y<0?3:0);}
