const commands=[
 {id:'archive',key:'B',ar:'الحجوزات',en:'Bookings'},
 {id:'billing',key:'L',ar:'الحسابات',en:'Billing'},
 {id:'cashiering',key:'C',ar:'الكاشير',en:'Cashiering'},
 {id:'revenue',key:'R',ar:'الإيرادات',en:'Revenue'},
 {id:'room-plan',key:'O',ar:'مخطط الغرف',en:'Room plan'},
 {id:'profiles',key:'G',ar:'ملفات النزلاء',en:'Guest profiles'},
 {id:'create-reservation',key:'N',ar:'حجز جديد',en:'New reservation'},
 {id:'create-profile',key:'I',ar:'ملف نزيل جديد',en:'New guest profile'},
 {id:'arrivals',key:'J',ar:'الوصول',en:'Arrivals'},
 {id:'departures',key:'D',ar:'المغادرة',en:'Departures'},
 {id:'reports',key:'T',ar:'التقارير',en:'Reports'},
 {id:'switch-user',key:'U',ar:'تبديل الموظف',en:'Switch user'},
];
function commandIds(values){return Array.isArray(values)?commands.filter(c=>values.includes(c.id)).map(c=>c.id):[];}
function mnemonic(ar,en,key,language){if(language==='ar')return `${ar} (&${key})`;const index=en.toLowerCase().indexOf(key.toLowerCase());return index<0?`${en} (&${key})`:en.slice(0,index)+'&'+en.slice(index);}
function altCommand(input){
 if(input.type!=='keyDown'||!input.alt||input.control||input.meta||input.shift)return null;
 const key=/^Key([A-Z])$/.exec(input.code||'')?.[1]||(input.key||'').toUpperCase();
 return commands.find(c=>c.key===key)?.id||null;
}
module.exports={commands,commandIds,mnemonic,altCommand};
