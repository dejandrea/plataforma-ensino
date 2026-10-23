import {useRef,useState} from 'react';
import {calculateDiscount,discountLabel,money,type CommercialDiscount} from '../lib/discounts';
import type {BillingInvoice} from '../lib/billing';

export function InvoiceDiscountForm({invoice,catalog,busy,onApply}:{invoice:BillingInvoice;catalog:CommercialDiscount[];busy:boolean;onApply:(args:Record<string,unknown>)=>Promise<boolean>}) {
 const [choice,setChoice]=useState(''),[amount,setAmount]=useState('');
 const pending=useRef<{payload:string;id:string}|null>(null);
 const selected=catalog.find(item=>item.id===choice);
 const value=Number(amount);
 const custom=choice==='custom';
 const effective=custom?{kind:'fixed' as const,value}:choice==='none'?{kind:'fixed' as const,value:0}:selected;
 const gross=Number(invoice.gross_amount),paid=Number(invoice.paid_total),maximum=Math.max(0,gross-paid);
 const preview=calculateDiscount(gross,effective);
 const requested=effective?.kind==='percentage'?Math.round(gross*Number(effective.value))/100:Number(effective?.value||0);
 const invalid=custom&&(!amount.trim()||!Number.isFinite(value)||value<=0||value>99999999.99||Math.abs(value*100-Math.round(value*100))>0.000001)||requested>maximum;
 const submit=async(event:React.FormEvent)=>{
  event.preventDefault();if(busy||invalid||!choice)return;
  const payload=JSON.stringify([choice,custom?value:null]);
  if(pending.current?.payload!==payload)pending.current={payload,id:crypto.randomUUID()};
  await onApply({p_invoice_id:invoice.id,p_discount_id:selected?.id||null,p_amount:selected?null:custom?value:0,p_request_id:pending.current.id});
 };
 return <details className="rounded-xl border border-white/10 p-3"><summary className="cursor-pointer font-semibold">Aplicar desconto nesta cobrança</summary>
 <form onSubmit={event=>void submit(event)} className="mt-4 space-y-3" aria-label="Desconto da cobrança"><fieldset disabled={busy} className="space-y-3">
 <p className="text-xs text-white/60">Vale somente para esta cobrança e substitui seu desconto atual. Os descontos não se acumulam.</p>
 {invoice.discount_override&&<p className="text-sm">Desconto aplicado: {invoice.discount_override.name} — {discountLabel(invoice.discount_override)}</p>}
 <label className="grid gap-2 text-sm">Tipo de desconto<select required className="input" value={choice} onChange={e=>setChoice(e.target.value)}><option value="">Selecione uma opção</option><option value="custom">Desconto avulso em valor (R$)</option><option value="none">Sem desconto nesta cobrança</option>{catalog.map(item=><option key={item.id} value={item.id}>{item.name} — {discountLabel(item)}</option>)}</select></label>
 {custom&&<label className="grid gap-2 text-sm">Valor do desconto avulso (R$)<input required type="number" min="0.01" max={Math.min(maximum,99999999.99)} step="0.01" className="input" value={amount} onChange={e=>setAmount(e.target.value)}/></label>}
 {choice&&<div aria-label="Prévia do desconto da cobrança" aria-live="polite" className="space-y-1 text-sm"><p>Valor original: {money(gross)}</p><p>Desconto: {money(preview.discount)}</p><p>Valor final previsto: {money(preview.net)}</p><p>Em aberto após desconto: {money(Math.max(0,preview.net-paid))}</p></div>}
 {invalid&&<p role="alert" className="text-sm text-rose-200">Informe um valor válido, com até duas casas decimais, que não ultrapasse {money(maximum)}.</p>}
 <button className="btn-primary" type="submit" disabled={busy||!choice||invalid||invoice.pricing_missing}>Aplicar desconto</button>
 </fieldset></form></details>;
}
