import React, { useState, useEffect } from 'react';
import './App.css';

// URL DE TU API ACTUALIZADA
const API_URL = "https://script.google.com/macros/s/AKfycby6mdGUr85p42mW1n126pXGRPjWGIxgoFchVw-_A8Q6CHx0yqnVOqt_gvspCdk59JY0/exec"; 

export default function App() {
  const [datos, setDatos] = useState({ productos: [], zonas: [], config: {} });
  const [carrito, setCarrito] = useState({});
  const [busqueda, setBusqueda] = useState('');
  const [cat, setCat] = useState('Todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  
  const [form, setForm] = useState({ 
    nombre: '', 
    dir: '', 
    zonaCosto: 0, 
    zonaNombre: '', 
    notas: '', 
    barriosSugeridos: '' 
  });

  useEffect(() => {
    fetch(API_URL)
      .then(res => res.json())
      .then(res => { 
        // Filtramos para que no aparezcan las filas de encabezados del Excel
        const prodsLimpios = res.data.productos.filter(p => typeof p.precio === 'number');
        setDatos({ productos: prodsLimpios, zonas: res.data.zonas, config: res.data.config });
        setLoading(false); 
      })
      .catch(e => console.error("Error:", e));
  }, []);

  // --- FUNCIÓN DE DETECCIÓN AUTOMÁTICA DE ZONA ---
  const detectarZona = (direccion) => {
    // 1. Pasamos lo que escribe el cliente a minúsculas
    const dirMin = direccion.toLowerCase();
  
    // 2. Buscamos la zona comparando todo en minúsculas
    const zonaEncontrada = datos.zonas.find(z => 
      z.palabrasClave.some(barrio => 
        // Comparamos el barrio del Excel (en minúsculas) con la dirección
        dirMin.includes(barrio.toLowerCase().trim())
      )
    );
  
    if (zonaEncontrada) {
      setForm(prev => ({
        ...prev,
        dir: direccion,
        zonaCosto: zonaEncontrada.costo,
        zonaNombre: zonaEncontrada.nombre,
        barriosSugeridos: zonaEncontrada.palabrasClave.join(", ")
      }));
    } else {
      // Si no hay coincidencia, solo actualizamos el texto de la dirección
      setForm(prev => ({ ...prev, dir: direccion }));
    }
  };

  const sumar = (prod, delta) => {
    setCarrito(prev => {
      const q = (prev[prod.nombre]?.q || 0) + delta;
      if (q < 0) return prev;
      return { ...prev, [prod.nombre]: { q, p: prod.precio } };
    });
  };

  const itemsCarrito = Object.keys(carrito).filter(k => carrito[k].q > 0);
  const subtotal = itemsCarrito.reduce((acc, k) => acc + (carrito[k].q * carrito[k].p), 0);
  
  // Cálculo de envío gratis dinámico desde el Excel
  const costoEnvio = subtotal >= (datos.config.envio_gratis_desde || 99999) ? 0 : parseInt(form.zonaCosto);
  const totalFinal = subtotal + costoEnvio;

  const enviar = async () => {
    // 1. Validaciones básicas
    if(!form.nombre || !form.dir || form.zonaCosto == 0) {
      return alert("Por favor, completa nombre, dirección y selecciona una zona.");
    }
    
    setProcesando(true);
    
    // 2. Armamos el mensaje de WhatsApp aquí mismo (sin esperar al servidor)
    const itemsTexto = itemsCarrito.map(k => `- ${carrito[k].q}x ${k} ($${carrito[k].q * carrito[k].p})`).join('\n');
    const mensaje = `*NUEVO PEDIDO DE LA WEB* 🍦\n\n*Cliente:* ${form.nombre}\n*Dirección:* ${form.dir}\n*Zona:* ${form.zonaNombre}\n\n*Pedido:*\n${itemsTexto}\n\n*Envío:* $${costoEnvio}\n*TOTAL FINAL: $${totalFinal}*\n\n*Notas:* ${form.notas}`;
    
    // 3. Obtenemos el número del Excel (o usamos uno por defecto si falla)
    const numeroWhatsApp = datos.config.whatsapp_negocio || "5491138416200"; 
    
    // 4. Abrimos WhatsApp INMEDIATAMENTE
    const url = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');

    // 5. Enviamos a Google Sheets en "segundo plano" para que quede registrado
    try {
      const pedidoParaGoogle = {
        nombre: form.nombre,
        direccion: form.dir,
        zona: form.zonaNombre,
        total: totalFinal,
        items: itemsCarrito.map(k => ({ n: `${carrito[k].q}x ${k}`, p: carrito[k].q * carrito[k].p }))
      };
      await fetch(API_URL, { method: 'POST', body: JSON.stringify(pedidoParaGoogle) });
    } catch (e) {
      console.log("El pedido se abrió en WhatsApp pero falló al guardarse en Excel (no es grave).");
    } finally {
      setProcesando(false);
      setCarrito({});
      setModalOpen(false);
    }
  };

  const prodsFiltrados = datos.productos.filter(p => 
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) && 
    (cat === 'Todos' || p.cat === cat)
  );

  return (
    <div className="app">
       <div className="banner">{datos.config.mensaje_banner || "¡Cargando ofertas!"}</div>
       
       <header>
         <h1 className="logo">Coco Baby</h1>
         <div className="search-wrapper">
            <input className="search" placeholder="¿Qué dulce buscás hoy?" onChange={e => setBusqueda(e.target.value)}/>
            <svg className="search-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
         </div>
       </header>

       <div className="tabs">
         {['Todos', 'Helados', 'Bebidas', 'Kiosco'].map(c => 
           <button key={c} className={`tab ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>{c}</button>
         )}
       </div>

       <div className="grid">
        {loading ? ( <p style={{gridColumn:'span 2', textAlign:'center'}}>Cargando dulzura...</p> ) : (
          prodsFiltrados.map((p) => (
            <div className="card" key={p.nombre}>
              <img src={p.img} alt={p.nombre} onClick={() => setDetalle(p)} style={{cursor:'pointer'}} />
              <div className="card-info">
                <h3>{p.nombre}</h3>
                <p className="card-price">${p.precio}</p>
                <div className="controls">
                  <button onClick={() => sumar(p, -1)}>-</button>
                  <span>{carrito[p.nombre]?.q || 0}</span>
                  <button onClick={() => sumar(p, 1)}>+</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

       {subtotal > 0 && (
         <button className="float-btn" onClick={() => setModalOpen(true)}>
           <span>Ver Pedido ({itemsCarrito.length})</span>
           <span>${subtotal}</span>
         </button>
       )}

       {/* MODAL CARRITO CON DETECCIÓN DE ZONAS */}
       {modalOpen && (
         <div className="modal-overlay">
           <div className="modal">
             <div className="modal-header">
                <h2>Finalizar Compra</h2>
                <button onClick={() => setModalOpen(false)}>✕</button>
             </div>
             <div className="resumen">
                {itemsCarrito.map(k => (
                  <div key={k} className="item-row">
                    <span>{carrito[k].q}x {k}</span>
                    <span>${carrito[k].q * carrito[k].p}</span>
                  </div>
                ))}
             </div>
             <hr/>

             <input 
               className="field" 
               placeholder="Dirección y Barrio (ej: Rivadavia 2000, Once)" 
               value={form.dir}
               onChange={e => detectarZona(e.target.value)}
             />

             <select 
               className="field" 
               value={form.zonaCosto} 
               onChange={e => {
                 const z = datos.zonas.find(z => z.costo == e.target.value);
                 setForm({...form, zonaCosto: e.target.value, zonaNombre: z?.nombre, barriosSugeridos: z?.palabrasClave.join(", ")});
               }}
             >
               <option value="0">📍 Seleccioná tu Zona de Entrega</option>
               {datos.zonas.map(z => (
                 <option key={z.id} value={z.costo}>{z.nombre} (+${z.costo})</option>
               ))}
             </select>

             {form.barriosSugeridos && (
               <p style={{fontSize: '12px', color: '#E91E63', marginTop: '-10px', marginBottom: '15px', fontWeight: 'bold'}}>
                 ✨ Zona sugerida: {form.zonaNombre}
               </p>
             )}

             <input className="field" placeholder="Tu Nombre" onChange={e => setForm({...form, nombre: e.target.value})}/>
             <textarea className="field" placeholder="Notas (sabores, timbre, etc.)" onChange={e => setForm({...form, notas: e.target.value})}/>
             
             <div style={{textAlign:'right'}}>
               {costoEnvio === 0 && subtotal > 0 && <p style={{color:'green', fontSize:'0.8rem', fontWeight:'bold'}}>¡Envío Gratis!</p>}
               <h3 style={{color:'#E91E63'}}>Total Final: ${totalFinal}</h3>
             </div>

             <button className="btn-confirm" onClick={enviar} disabled={procesando}>
               {procesando ? 'PROCESANDO...' : 'CONFIRMAR POR WHATSAPP'}
             </button>
           </div>
         </div>
       )}

       {/* MODAL DETALLE DE PRODUCTO */}
       {detalle && (
         <div className="modal-overlay" style={{zIndex: 3000}}>
           <div className="modal">
             <button onClick={() => setDetalle(null)} style={{float:'right', background:'none', border:'none', fontSize:'28px'}}>✕</button>
             <img src={detalle.img} style={{width:'100%', borderRadius:'20px', height:'250px', objectFit:'cover'}} />
             <h2 style={{marginTop:'15px'}}>{detalle.nombre}</h2>
             <p style={{color:'#666'}}>{detalle.descripcion}</p>
             <p style={{fontSize:'1.8rem', color:'#E91E63', fontWeight:'bold'}}>${detalle.precio}</p>
             <button onClick={() => { sumar(detalle, 1); setDetalle(null); }} className="btn-confirm">
                AGREGAR AL CARRITO
             </button>
           </div>
         </div>
       )}

       <a href={`https://wa.me/${datos.config.whatsapp_negocio}`} className="whatsapp-float" target="_blank" rel="noreferrer">
         <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" />
       </a>
    </div>
  );
}