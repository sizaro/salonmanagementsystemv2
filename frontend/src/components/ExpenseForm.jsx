import { useEffect, useState } from "react";

export default function ExpenseForm({ onSubmit, onClose, expenseData, entryType = "current" }) {
  const isPast = (expenseData?.entry_type || entryType) === "past";
  const [form, setForm] = useState({ id:"", name:"", amount:"", description:"", expense_date:"", expense_time:"", backdate_reason:"" });
  useEffect(() => { if (expenseData) setForm({ id:expenseData.id||"", name:expenseData.name||"", amount:expenseData.amount||"", description:expenseData.description||"", expense_date:expenseData.expense_date||"", expense_time:String(expenseData.expense_time||"").slice(0,5), backdate_reason:expenseData.backdate_reason||"" }); }, [expenseData]);
  const change=(e)=>setForm((value)=>({...value,[e.target.name]:e.target.value}));
  const submit=async(e)=>{e.preventDefault();const payload={id:form.id||undefined,name:form.name.trim(),amount:Number(form.amount),description:form.description.trim(),entry_type:isPast?"past":"current"};if(isPast)Object.assign(payload,{expense_date:form.expense_date,expense_time:form.expense_time,backdate_reason:form.backdate_reason.trim()});await onSubmit(payload);onClose?.();};
  return <form onSubmit={submit} className="space-y-4 p-4 bg-white rounded shadow-md max-w-md mx-auto">
    <div><h2 className="text-2xl font-bold text-gray-800">{form.id?"Edit Expense":isPast?"Add Past Expense":"Add Expense"}</h2>{isPast&&<p className="mt-1 text-sm text-amber-600">This is a historical expense. Its original date/time and reason are required.</p>}</div>
    <div className="flex flex-col"><label className="mb-1 font-medium text-gray-700">Expense Name</label><input required type="text" name="name" value={form.name} onChange={change} className="border border-gray-300 rounded px-3 py-2" /></div>
    <div className="flex flex-col"><label className="mb-1 font-medium text-gray-700">Amount</label><input required min="0" type="number" name="amount" value={form.amount} onChange={change} className="border border-gray-300 rounded px-3 py-2" /></div>
    <div className="flex flex-col"><label className="mb-1 font-medium text-gray-700">Description</label><textarea name="description" value={form.description} onChange={change} className="border border-gray-300 rounded px-3 py-2" /></div>
    {isPast&&<><div className="grid grid-cols-2 gap-3"><div className="flex flex-col"><label className="mb-1 font-medium text-gray-700">Expense Date</label><input required type="date" name="expense_date" value={form.expense_date} onChange={change} className="border border-gray-300 rounded px-3 py-2" /></div><div className="flex flex-col"><label className="mb-1 font-medium text-gray-700">Expense Time</label><input required type="time" name="expense_time" value={form.expense_time} onChange={change} className="border border-gray-300 rounded px-3 py-2" /></div></div><div className="flex flex-col"><label className="mb-1 font-medium text-gray-700">Why is this being recorded late?</label><textarea required name="backdate_reason" value={form.backdate_reason} onChange={change} className="border border-gray-300 rounded px-3 py-2" /></div></>}
    <button type="submit" className="mt-4 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded w-full">{form.id?"Update Expense":isPast?"Save Past Expense":"Add Expense"}</button>
  </form>;
}
