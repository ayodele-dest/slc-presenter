import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeThemeDraft, validateThemeDraft } from '../src/theme-model.js';

test('normalizes theme geometry without changing the canvas coordinate model',()=>{const theme=normalizeThemeDraft({name:' Test ',canvasWidth:1920,canvasHeight:1080,elements:[{id:'a',type:'text',name:'Heading',x:1900,y:-20,width:400,height:0,opacity:2}]});assert.equal(theme.name,'Test');assert.deepEqual([theme.canvasWidth,theme.canvasHeight],[1920,1080]);assert.deepEqual([theme.elements[0].x,theme.elements[0].y,theme.elements[0].width,theme.elements[0].height,theme.elements[0].opacity],[1520,0,400,20,1])});

test('rejects incomplete image layers and backgrounds before persistence',()=>{const{errors}=validateThemeDraft({name:'Images',background:{type:'image'},elements:[{id:'image',name:'Logo',type:'image',x:0,y:0,width:200,height:100}]});assert.equal(errors.length,2);assert.match(errors.join(' '),/background/);assert.match(errors.join(' '),/Logo/)});
