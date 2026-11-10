const {test}=require('node:test'),assert=require('node:assert/strict');
const {commands,commandIds,mnemonic,altCommand}=require('../src/commands.cjs');
test('Alt actions have distinct keys and exclude native top-menu mnemonics',()=>{
 assert.equal(new Set(commands.map(c=>c.key)).size,commands.length);
 for(const c of commands)assert(!['F','E','V','W','A','H'].includes(c.key));
});
test('only the fixed native command catalog can enter a menu',()=>{
 assert.deepEqual(commandIds(['billing','execute-file','revenue','billing']),['billing','revenue']);
 assert.deepEqual(commandIds({billing:true}),[]);
});
test('Arabic and English menus expose matching Alt access keys',()=>{
 assert.equal(mnemonic('ملف','File','F','en'),'&File');
 assert.equal(mnemonic('الحسابات','Billing','L','en'),'Bi&lling');
 assert.equal(mnemonic('ملف','File','F','ar'),'ملف (&F)');
});
test('Alt commands use physical keys across keyboard layouts without stealing AltGr or menu keys',()=>{
 assert.equal(altCommand({type:'keyDown',alt:true,key:'ل',code:'KeyB'}),'archive');
 assert.equal(altCommand({type:'keyDown',alt:true,key:'l',code:'KeyL'}),'billing');
 assert.equal(altCommand({type:'keyDown',alt:true,key:'l',code:'KeyL',control:true}),null);
 assert.equal(altCommand({type:'keyDown',alt:true,key:'l',code:'KeyL',shift:true}),null);
 assert.equal(altCommand({type:'keyDown',alt:true,key:'f',code:'KeyF'}),null);
});
