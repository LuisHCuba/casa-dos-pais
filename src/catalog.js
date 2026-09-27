// Catálogo de itens: dbId do HomeByMe → rótulo e cor no visualizador.
// O export do HomeByMe NÃO traz nomes de produtos, só dbId + parâmetros.
// Os rótulos abaixo foram inferidos pelos parâmetros do item (ex.: "canape", "lit", "douche")
// ou pelas dimensões. Edite livremente.

const known = {
  '18831_50679': { label: 'Sofá', color: '#b9b2a6' },
  '20809': { label: 'Cama', color: '#d9cbb3' },
  'mdm_lit_17': { label: 'Cama', color: '#d9cbb3' },
  '46443': { label: 'Box de chuveiro', color: '#bcd7e6' },
  '2548': { label: 'Base de chuveiro', color: '#e6eef2' },
  '2229': { label: 'Gabinete de pia', color: '#cfc6b8' },
  '19529': { label: 'Armários de cozinha', color: '#a9b4a2' },
  '73731': { label: 'Mesa (1,80 × 0,90)', color: '#a88a6a' },
  '42673': { label: 'Tapete', color: '#c9bca6' },
  '73942': { label: 'Rack', color: '#8f7a64' },
  'sony_eve_05': { label: 'TV', color: '#222222' },
  '73831': { label: 'Guarda-roupa', color: '#c8b89e' },
  '1278848': { label: 'Carro (produto do usuário)', color: '#9aa4ad' },
};

export function describe(item) {
  if (known[item.dbId]) return known[item.dbId];
  const p = item.params || {};
  if ('bulb0-intensity' in p) return { label: 'Luminária', color: '#f2d27a' };
  if (/^akupanel|^2169\d$/.test(item.dbId)) return { label: 'Painel ripado', color: '#8a6a4a' };
  if (/^gen_bio|^767$|gen_trop/.test(item.dbId)) return { label: 'Planta', color: '#6f9a5c' };
  if (item.userProduct) return { label: `Produto do usuário ${item.dbId}`, color: '#9a8fb0' };
  return { label: `Item ${item.dbId}`, color: '#b8a58c' };
}

export const openingColor = (o) => (o.window ? '#8fc1dd' : '#7a5a3c');
