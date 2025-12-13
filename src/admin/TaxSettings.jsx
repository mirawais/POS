import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const emptyForm = { id: null, name: '', rate: 0, active: true };

export default function TaxSettings() {
  const [taxes, setTaxes] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const loadTaxes = async () => {
    const { data, error } = await supabase.from('taxes').select('*').order('created_at');
    if (error) setMessage(error.message);
    else setTaxes(data || []);
  };

  useEffect(() => {
    loadTaxes();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    const payload = {
      name: form.name,
      rate: Number(form.rate) || 0,
      active: form.active,
    };
    const query = form.id
      ? supabase.from('taxes').update(payload).eq('id', form.id)
      : supabase.from('taxes').insert(payload);
    const { error } = await query;
    if (error) setMessage(error.message);
    else {
      setForm(emptyForm);
      await loadTaxes();
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from('taxes').delete().eq('id', id);
    if (error) setMessage(error.message);
    else await loadTaxes();
  };

  const toggleActive = async (id, active) => {
    await supabase.from('taxes').update({ active: !active }).eq('id', id);
    await loadTaxes();
  };

  return (
    <div>
      <h2>Tax Settings</h2>
      <form onSubmit={handleSubmit}>
        <input
          placeholder="Name (e.g., GST 13%)"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />
        <input
          type="number"
          step="0.0001"
          placeholder="Rate (0.13)"
          value={form.rate}
          onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
          required
        />
        <label>
          Active
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
          />
        </label>
        <button type="submit" disabled={loading}>
          {form.id ? 'Update' : 'Create'}
        </button>
        {form.id && (
          <button type="button" onClick={() => setForm(emptyForm)}>
            Cancel
          </button>
        )}
      </form>

      <ul>
        {taxes.map((tax) => (
          <li key={tax.id}>
            {tax.name} ({(Number(tax.rate) * 100).toFixed(2)}%) — {tax.active ? 'Active' : 'Inactive'}
            <button onClick={() => setForm(tax)}>Edit</button>
            <button onClick={() => toggleActive(tax.id, tax.active)}>
              {tax.active ? 'Deactivate' : 'Activate'}
            </button>
            <button onClick={() => handleDelete(tax.id)}>Delete</button>
          </li>
        ))}
      </ul>
      {message && <p>{message}</p>}
    </div>
  );
}

