import { useState, useEffect, useRef } from 'react';
import { X, MapPin, Clock, AlertCircle, CheckCircle, Star } from 'lucide-react';
import { OrderService } from '../services/orderService';
import { completeSubmission, submissionIdentity } from '../lib/submission';
import { supabase } from '../lib/supabase';
import { waLink } from '../data/constants';
import { LocationService } from '../services/locationService';
import { formatServiceLabel, type OrderItem, type PaymentMethod, type Service } from '../lib/whatsapp';
import type { CustomerLocation } from '../types/order';
import type { AppliedPromotion } from '../types/promotion';
import type { Barrio } from '../data/barrios';
import { cop } from '../lib/format';
import { toBirthdayKey } from '../lib/birthday';

interface CartDrawerProps {
  isOpen: boolean;
  autoSubmit?: boolean;
  onClose: () => void;
  items: (OrderItem & { baseLine: number; line?: number })[];
  subtotal: number;
  delivery: number;
  total: number;
  name: string;
  phone: string;
  birthday?: string;
  email?: string;
  service: Service;
  tableNumber: string;
  barrio: Barrio | null;
  address: string;
  reference: string;
  paymentMethod: PaymentMethod;
  comments: string;
  initialLocation?: CustomerLocation | null;
  onClearCart: () => void;
  descuentoTotal?: number;
  appliedPromotions?: AppliedPromotion[];
  couponInput?: string;
  onCouponInputChange?: (value: string) => void;
  onApplyCoupon?: () => void;
  onRemoveCoupon?: () => void;
  appliedCouponCode?: string | null;
  couponError?: string | null;
}

export default function CartDrawer({
  isOpen,
  autoSubmit = false,
  onClose,
  items,
  subtotal,
  delivery,
  total,
  name,
  phone,
  birthday = '',
  email = '',
  service,
  tableNumber,
  barrio,
  address,
  reference,
  paymentMethod,
  comments,
  initialLocation = null,
  onClearCart,
  descuentoTotal = 0,
  appliedPromotions = [],
  couponInput = '',
  onCouponInputChange,
  onApplyCoupon,
  onRemoveCoupon,
  appliedCouponCode = null,
  couponError = null,
}: CartDrawerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [currentLocation, setCurrentLocation] = useState<CustomerLocation | null>(initialLocation);
  const [isTrackingLocation, setIsTrackingLocation] = useState(false);
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState<string | null>(null);
  const autoSubmitTriggeredRef = useRef(false);
  const submissionLock = useRef(false);
  const lastLocationRef = useRef<CustomerLocation | null>(initialLocation);
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [confirmedDetails, setConfirmedDetails] = useState<{ items: (OrderItem & { baseLine: number; line?: number })[]; subtotal: number; delivery: number; total: number; descuentoTotal: number; service: Service; tableNumber: string; address: string; barrio: string; paymentMethod: PaymentMethod } | null>(null);
  const [confirmationPanel, setConfirmationPanel] = useState<'review' | 'details' | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewStatus, setReviewStatus] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const reviewLock = useRef(false);
  useEffect(() => () => LocationService.stopWatchingLocation(), []);

  // Hook para generar mensaje de WhatsApp
  useEffect(() => {
    if (initialLocation) {
      setCurrentLocation(initialLocation);
    }
  }, [initialLocation]);

  // Verificar permisos de ubicación al abrir el drawer
  useEffect(() => {
    if (isOpen && navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setLocationPermission(result.state);
      });
    }
  }, [isOpen]);

  // Obtener ubicación inicial
  const handleGetLocation = async () => {
    try {
      setIsTrackingLocation(true);
      const location = await LocationService.getCurrentLocation();
      setCurrentLocation(location);
      setLocationPermission('granted');
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationPermission('denied');
    } finally {
      setIsTrackingLocation(false);
    }
  };

  // Iniciar seguimiento en tiempo real
  const startLocationTracking = (orderId: string) => {

    LocationService.startWatchingLocation(
      async (location) => {
        setCurrentLocation(location);
        // Actualizar ubicación en Firestore solo si hay movimiento significativo
        if (!lastLocationRef.current || LocationService.hasSignificantMovement(lastLocationRef.current, location, 10)) {
          try {
            await OrderService.updatePublicLocation(orderId, location);
            lastLocationRef.current = location;
          } catch (error) {
            console.error('Error updating location:', error);
          }
        }
      },
      (error) => {
        console.error('Location tracking error:', error);
      }
    );
  };

  // Detener seguimiento
  const stopLocationTracking = () => {
    LocationService.stopWatchingLocation();
  };

  // Validar datos del formulario
  const validateForm = (): boolean => {
    if (!name.trim() || !phone.trim()) {
      setErrorMessage('Nombre y teléfono son obligatorios');
      return false;
    }

    if (service === 'domicilio' && (!barrio || !address.trim())) {
      setErrorMessage('Para domicilio necesitas seleccionar barrio y dirección');
      return false;
    }
    if (service === 'local' && !tableNumber) {
      setErrorMessage('Selecciona la mesa donde estás.');
      return false;
    }

    if (items.length === 0) {
      setErrorMessage('Agrega al menos un producto');
      return false;
    }

    if (total <= 0) {
      setErrorMessage('El total debe ser mayor a $0');
      return false;
    }

    return true;
  };

  const confirmOrder = () => {
    if (!validateForm()) {
      setSubmitStatus('error');
      return;
    }
    void handleSubmitOrder();
  };

  // Crear pedido en Firestore
  const handleSubmitOrder = async () => {
    if (submissionLock.current) return;
    if (!validateForm()) {
      setSubmitStatus('error');
      return;
    }

    submissionLock.current = true;
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      const numeroOrden = OrderService.generateOrderNumber();
      const birthdayKey = toBirthdayKey(birthday);

      // Se guarda el item "limpio" (sin los campos de precio calculado que
      // solo se usan para mostrar el resumen), conservando el detalle de
      // descuentos por producto como una foto del momento de la compra.
      const itemsForOrder = items.map((it: OrderItem & { baseUnit?: number; extrasUnit?: number; unit?: number; line?: number; baseLine?: number }) => {
        const { baseUnit, extrasUnit, unit, line, baseLine, discounts, ...rest } = it;
        void baseUnit; void extrasUnit; void unit; void line; void baseLine;
        return discounts && discounts.length ? { ...rest, discounts } : rest;
      });

      const orderData = {
        numeroOrden,
        couponCode: appliedCouponCode,
        items: itemsForOrder,
        total,
        subtotal,
        delivery,
        cliente: {
          nombres: name.trim(),
          celular: phone.trim(),
          direccion: service === 'domicilio' ? address.trim() : '',
          ...(service === 'local' && tableNumber ? { mesa: Number(tableNumber) } : {}),
          ...(service === 'domicilio' && barrio ? { barrio: barrio.name } : {}),
          ...(service === 'domicilio' && reference.trim() ? { referencia: reference.trim() } : {}),
          ...(birthdayKey ? { fechaNacimiento: birthdayKey } : {}),
          ...(email.trim() ? { correo: email.trim() } : {}),
          ...(currentLocation ? {
            coordenadas: currentLocation,
            mapsLink: LocationService.generateMapsLink(currentLocation),
            ubicacionTiempoReal: [currentLocation]
          } : {})
        },
        formaPago: paymentMethod,
        servicio: service,
        estado: 'no_pagado' as const,
        ...(comments.trim() ? { comentarios: comments.trim() } : {}),
        ...(appliedPromotions.length > 0 ? {
          promociones: appliedPromotions,
          descuentoTotal,
        } : {})
      };

      const orderId = await OrderService.createOrder(orderData);
      setCreatedOrderId(orderId);
      setConfirmedDetails({ items: structuredClone(items), subtotal, delivery, total, descuentoTotal, service, tableNumber, address, barrio: barrio?.name || '', paymentMethod });
      const receipt = JSON.parse(sessionStorage.getItem('la-tuba-order-receipt') || '{}');
      setConfirmedOrderNumber(receipt.order_number || numeroOrden);
      setWhatsappUrl(waLink(`Hola, registré el pedido ${receipt.order_number || numeroOrden} a nombre de ${name.trim()}. Total: ${cop(total)}. ${formatServiceLabel(service)}.`));
      setSubmitStatus('success');

      
      // Iniciar seguimiento de ubicación si está disponible
      if (currentLocation && service === 'domicilio') {
        startLocationTracking(orderId);
      }

      // Guardar/actualizar cliente en la base de datos
      try {
        const clientData: { celular: string; nombres: string; totalPedido: number; direccion?: string; barrio?: string; referencia?: string; fechaNacimiento?: string; correo?: string } = {
          celular: phone.trim(),
          nombres: name.trim(),
          totalPedido: total
        };
        
        // Solo agregar campos opcionales si tienen valor
        if (service === 'domicilio' && address.trim()) {
          clientData.direccion = address.trim();
        }
        if (barrio?.name) {
          clientData.barrio = barrio.name;
        }
        if (reference?.trim()) {
          clientData.referencia = reference.trim();
        }
        if (birthdayKey) {
          clientData.fechaNacimiento = birthdayKey;
        }
        if (email.trim()) {
          clientData.correo = email.trim();
        }

        void clientData; // El RPC de Supabase ya guardó el contacto junto con el pedido.
        console.log('✅ Cliente guardado/actualizado correctamente');
      } catch (clientError) {
        console.error('❌ Error guardando cliente:', clientError);
      }

      // Enviar notificación al negocio sobre nuevo pedido
      // Limpiar carrito después de un delay
      onClearCart();
      completeSubmission('order');

    } catch (error) {
      console.error('Error creating order:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Error al crear el pedido. Intenta nuevamente.');
      setSubmitStatus('error');
    } finally {
      submissionLock.current = false;
      setIsSubmitting(false);
    }
  };

  const submitReview = async (event: React.FormEvent) => {
    event.preventDefault();
    if (reviewLock.current || reviewSubmitted) return;
    if (!reviewRating) { setReviewStatus('Selecciona una calificación de una a cinco estrellas.'); return; }
    const comment = reviewComment.trim();
    if (comment.length < 5) { setReviewStatus('Escribe un comentario de al menos 5 caracteres.'); return; }
    if (!supabase) { setReviewStatus('No hay conexión disponible. Intenta nuevamente.'); return; }
    reviewLock.current = true; setReviewBusy(true); setReviewStatus('');
    try {
      const payload = { name: name.trim(), rating: reviewRating, comment };
      const identity = submissionIdentity('review', payload);
      const { error } = await supabase.rpc('submit_review', { p_name: payload.name, p_rating: payload.rating, p_comment: payload.comment, p_request_id: identity.requestId });
      if (error) throw error;
      completeSubmission('review'); setReviewSubmitted(true); setReviewStatus('Gracias. Tu reseña quedó pendiente de aprobación.');
    } catch {
      setReviewStatus('No pudimos enviar tu reseña. Revisa tu conexión y vuelve a intentarlo; tu pedido está guardado.');
    } finally { reviewLock.current = false; setReviewBusy(false); }
  };

  useEffect(() => {
    if (!isOpen) {
      autoSubmitTriggeredRef.current = false;
      return;
    }
    if (!autoSubmit || autoSubmitTriggeredRef.current) return;
    autoSubmitTriggeredRef.current = true;
    confirmOrder();
    // La apertura desde el resumen debe confirmar una sola vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, autoSubmit]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden">
      {/* Overlay */}
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label="Cerrar carrito"
      />
      
      {/* Drawer */}
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl">
        <div className="relative flex h-full flex-col">
          {isSubmitting && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-crema px-6 text-center">
              <Clock size={34} className="animate-spin text-rojo" />
              <h2 className="mt-5 text-xl font-semibold text-rojo-dark">Confirmando tu pedido</h2>
              <p className="mt-2 text-sm text-gray-500">Estamos guardando la orden. No cierres esta pantalla.</p>
            </div>
          )}
          {autoSubmit && submitStatus === 'error' && !isSubmitting && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-crema px-6 text-center">
              <AlertCircle size={38} className="text-rojo" />
              <h2 className="mt-5 text-xl font-semibold text-rojo-dark">No pudimos confirmar el pedido</h2>
              <p className="mt-2 max-w-xs text-sm text-gray-500">{errorMessage || 'Revisa tu conexión e intenta nuevamente.'}</p>
              <button type="button" onClick={confirmOrder} className="mt-7 w-full max-w-xs bg-rojo px-5 py-3 text-sm font-semibold text-crema">Intentar de nuevo</button>
              <button type="button" onClick={onClose} className="mt-3 text-sm font-semibold text-gray-500">Volver al resumen</button>
            </div>
          )}
          {submitStatus === 'success' && (
            <div className="absolute inset-0 z-20 flex flex-col overflow-y-auto bg-crema px-6 pb-10 pt-20 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rojo text-crema">
                <CheckCircle size={42} strokeWidth={1.8} />
              </div>
              <h2 className="mt-3 text-3xl font-semibold text-rojo-dark">¡Recibimos tu pedido!</h2>
              <p className="mx-auto mt-4 max-w-xs text-sm leading-relaxed text-gray-600">
                La Tuba Gastrobar revisará tu orden y se comunicará contigo al número registrado.
              </p>
              {confirmedOrderNumber && (
                <div className="mx-auto mt-7 border-y border-rojo/20 px-8 py-4">
                  <span className="block text-[10px] uppercase tracking-[0.2em] text-gray-500">Número de pedido</span>
                  <strong className="mt-1 block text-lg text-rojo-dark">{confirmedOrderNumber}</strong>
                </div>
              )}
              <div className="mt-auto space-y-3">
                {whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noreferrer" className="block w-full border border-rojo px-5 py-3.5 font-semibold text-rojo">Compartir pedido por WhatsApp</a>}
                <button type="button" onClick={() => setConfirmationPanel('details')} className="w-full border border-rojo px-5 py-3 text-sm font-semibold text-rojo">Ver detalle de mi pedido</button>
                <button type="button" onClick={() => setConfirmationPanel('review')} className="w-full border border-rojo px-5 py-3 text-sm font-semibold text-rojo">Dejar reseña</button>
                <button type="button" onClick={() => { stopLocationTracking(); onClose(); window.location.assign('/'); }} className="w-full bg-rojo px-5 py-3.5 text-sm font-semibold text-crema">
                  Volver al inicio
                </button>
                <button type="button" onClick={() => { stopLocationTracking(); onClose(); window.location.assign('/catalogo'); }} className="w-full border border-rojo px-5 py-3 text-sm font-semibold text-rojo">
                  Hacer otro pedido
                </button>
              </div>
            </div>
          )}
          {submitStatus === 'success' && confirmationPanel && <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="confirmation-panel-title">
            <div className="max-h-[85dvh] w-full overflow-y-auto bg-crema p-5 text-left shadow-xl">
              <div className="flex items-center justify-between gap-4"><h3 id="confirmation-panel-title" className="font-serif text-2xl text-rojo-dark">{confirmationPanel === 'review' ? 'Deja tu reseña' : 'Detalle de tu pedido'}</h3><button type="button" onClick={() => setConfirmationPanel(null)} aria-label="Cerrar ventana" className="rounded p-2 text-rojo"><X size={20} /></button></div>
              {confirmationPanel === 'review' ? <form onSubmit={event => void submitReview(event)} className="mt-4">
                <p className="text-sm text-stone-600">¿Cómo fue tu experiencia?</p>
                <fieldset className="mt-3"><legend className="text-xs font-semibold">Selecciona una calificación</legend><div className="mt-1 flex gap-1" role="radiogroup" aria-label="Calificación de la reseña">{[1, 2, 3, 4, 5].map(value => <button key={value} type="button" role="radio" aria-checked={reviewRating === value} aria-label={`${value} ${value === 1 ? 'estrella' : 'estrellas'}`} disabled={reviewSubmitted} onClick={() => { setReviewRating(value); setReviewStatus(''); }} className="p-1 text-amber-600 disabled:opacity-70"><Star size={32} fill={value <= reviewRating ? 'currentColor' : 'none'} /></button>)}</div></fieldset>
                <label className="mt-4 block text-sm font-semibold">Comentario<textarea required minLength={5} maxLength={2000} rows={4} value={reviewComment} disabled={reviewSubmitted} onChange={event => setReviewComment(event.target.value)} placeholder="Cuéntanos tu experiencia" className="mt-2 w-full border border-rojo/25 bg-white p-3 font-normal" /></label>
                {!reviewSubmitted && <button disabled={reviewBusy} type="submit" className="mt-3 w-full bg-rojo px-4 py-3 font-semibold text-crema disabled:opacity-50">{reviewBusy ? 'Enviando…' : 'Enviar reseña'}</button>}
                {reviewStatus && <p role="status" className="mt-3 text-sm text-rojo">{reviewStatus}</p>}
              </form> : confirmedDetails && <div className="mt-4 text-sm">
                <p className="text-stone-600">Pedido {confirmedOrderNumber}</p><div className="mt-3 divide-y border-y border-rojo/15">{confirmedDetails.items.map(item => <div key={item.id} className="py-3"><div className="flex justify-between gap-3"><b>{item.qty} × {item.product.name}</b><b className="shrink-0">{cop(item.line ?? item.baseLine)}</b></div>{item.product.dailyMenuId && item.product.description && <p className="mt-1 text-xs text-stone-600">{item.product.description}</p>}{item.note?.trim() && <p className="mt-1 whitespace-pre-line text-xs text-stone-600">{item.note}</p>}</div>)}</div>
                <div className="mt-3 space-y-2"><p className="flex justify-between"><span>Subtotal</span><span>{cop(confirmedDetails.subtotal)}</span></p><p className="flex justify-between"><span>Domicilio</span><span>{cop(confirmedDetails.delivery)}</span></p>{confirmedDetails.descuentoTotal > 0 && <p className="flex justify-between"><span>Descuento</span><span>−{cop(confirmedDetails.descuentoTotal)}</span></p>}<p className="flex justify-between border-t border-rojo/15 pt-2 text-base font-semibold"><span>Total</span><span>{cop(confirmedDetails.total)}</span></p></div>
                <div className="mt-4 space-y-1 text-stone-600"><p>Servicio: {formatServiceLabel(confirmedDetails.service)}{confirmedDetails.service === 'local' && confirmedDetails.tableNumber ? ` · Mesa ${confirmedDetails.tableNumber}` : ''}</p>{confirmedDetails.service === 'domicilio' && <p>Entrega: {confirmedDetails.address}{confirmedDetails.barrio ? ` · ${confirmedDetails.barrio}` : ''}</p>}<p>Medio de pago: {confirmedDetails.paymentMethod}</p></div>
                <button type="button" onClick={() => setConfirmationPanel(null)} className="mt-5 w-full border border-rojo px-4 py-3 font-semibold text-rojo">Volver a la confirmación</button>
              </div>}
            </div>
          </div>}
          {/* Header */}
          <div className="relative flex items-center justify-center border-b border-gray-200 p-4">
            <h2 className="text-center text-lg font-semibold text-black">Finalizar Pedido</h2>
            <button
              onClick={onClose}
              className="absolute right-4 rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-black"
              aria-label="Cerrar carrito"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 pb-8">
            {/* Resumen del pedido */}
            <div className="mb-6 border-b border-gray-200 pb-5">
              <h3 className="mb-3 text-center text-sm font-semibold text-black">Tu pedido</h3>

              <div className="mb-4 divide-y divide-gray-200 border-y border-gray-200">
                {items.map((item) => (
                  <div key={item.id} className="py-3">
                    <div className="flex items-start justify-between gap-4 text-sm">
                      <span className="font-semibold text-gray-900">{item.product.name}</span>
                      <span className="shrink-0 font-semibold text-rojo">{cop(item.baseLine)}</span>
                    </div>
                    {item.note?.trim() && (
                      <p className="mt-1 text-xs leading-relaxed text-gray-500">IndicaciÃ³n: {item.note.trim()}</p>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Productos ({items.length})</span>
                  <span>{cop(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Envío</span>
                  <span>{cop(delivery)}</span>
                </div>

                {onApplyCoupon ? (
                  appliedCouponCode ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs">
                      <span className="text-green-700 font-semibold truncate">
                        Cupón <span className="font-mono">{appliedCouponCode}</span> aplicado
                      </span>
                      <button
                        type="button"
                        onClick={onRemoveCoupon}
                        className="text-green-700 underline underline-offset-2 shrink-0"
                      >
                        Quitar
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex gap-2">
                        <input
                          value={couponInput}
                          onChange={(e) => onCouponInputChange?.(e.target.value.toUpperCase())}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              onApplyCoupon();
                            }
                          }}
                          placeholder="Código de cupón"
                          className="flex-1 min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono uppercase outline-none focus:border-black"
                        />
                        <button
                          type="button"
                          onClick={onApplyCoupon}
                          className="rounded-lg border border-black px-3 py-2 text-xs font-semibold hover:bg-black hover:text-white transition-colors shrink-0"
                        >
                          Aplicar
                        </button>
                      </div>
                      {couponError && <div className="text-xs text-rojo">{couponError}</div>}
                    </div>
                  )
                ) : null}

                {appliedPromotions.map((promo, i) => (
                  <div key={i} className="flex justify-between text-rojo font-medium">
                    <span>{promo.nombre}</span>
                    <span>-{cop(promo.descuento)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold text-black">
                  <span>Total</span>
                  <span>{cop(total)}</span>
                </div>
              </div>
            </div>

            {/* Datos del cliente */}
            <div className="mb-6 border-b border-gray-200 pb-5">
              <h3 className="mb-3 text-center text-sm font-semibold text-black">Datos de Entrega</h3>
              
              <div className="space-y-2 text-sm text-gray-500">
                <div><span className="font-semibold">Nombre:</span> {name}</div>
                <div><span className="font-semibold">Teléfono:</span> {phone}</div>
                <div><span className="font-semibold">Servicio:</span> {formatServiceLabel(service)}</div>
                {service === 'domicilio' && (
                  <>
                    <div><span className="font-semibold">Barrio:</span> {barrio?.name || 'No seleccionado'}</div>
                    <div><span className="font-semibold">Dirección:</span> {address}</div>
                    {reference && <div><span className="font-semibold">Referencia:</span> {reference}</div>}
                  </>
                )}
                <div><span className="font-semibold">Pago:</span> {paymentMethod}</div>
                {comments && <div><span className="font-semibold">Comentarios:</span> {comments}</div>}
              </div>
            </div>

            {/* Ubicación en tiempo real */}
            {service === 'domicilio' && (
              <div className="mb-6 border-b border-gray-200 pb-5">
                <h3 className="mb-3 flex items-center justify-center gap-2 text-center text-sm font-semibold text-black">
                  <MapPin size={16} />
                  Ubicación en Tiempo Real
                </h3>
                
                {locationPermission === 'denied' && (
                  <div className="flex items-center gap-2 text-sm text-red-600">
                    <AlertCircle size={16} />
                    Permisos de ubicación denegados
                  </div>
                )}
                
                {locationPermission === 'prompt' && (
                  <button
                    onClick={handleGetLocation}
                    disabled={isTrackingLocation}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-gray-100 px-4 py-2 text-sm text-black hover:bg-gray-200 disabled:opacity-50"
                  >
                    {isTrackingLocation ? (
                      <>
                        <Clock size={16} className="animate-spin" />
                        Obteniendo ubicación...
                      </>
                    ) : (
                      <>
                        <MapPin size={16} />
                        Compartir Ubicación
                      </>
                    )}
                  </button>
                )}
                
                {currentLocation && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-rojo">
                      <CheckCircle size={16} />
                      Ubicación obtenida
                    </div>
                    <div className="text-xs text-gray-500">
                      Lat: {currentLocation.lat.toFixed(6)}, Lng: {currentLocation.lng.toFixed(6)}
                      {currentLocation.accuracy && (
                        <div>Precisión: ±{Math.round(currentLocation.accuracy)}m</div>
                      )}
                    </div>
                    {createdOrderId && (
                      <div className="text-xs text-blue-600">
                        📍 Compartiendo ubicación en tiempo real
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Estado del envío */}
            {submitStatus === 'success' && (
              <div className="mb-4 rounded-2xl border border-rojo bg-rojo-light p-4">
                <div className="flex items-center gap-2 text-rojo">
                  <CheckCircle size={20} />
                  <span className="font-semibold">¡Pedido creado exitosamente!</span>
                </div>
                <p className="mt-2 text-sm text-rojo">
                  Tu pedido ha sido guardado correctamente.
                </p>
                {service === 'domicilio' && currentLocation && (
                  <p className="mt-1 text-xs text-rojo">
                    Tu ubicación se está compartiendo en tiempo real para facilitar la entrega.
                  </p>
                )}
              </div>
            )}

            {/* Error */}
            {submitStatus === 'error' && errorMessage && (
              <div className="mb-4 rounded-2xl border border-red-300 bg-red-50 p-4">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle size={20} />
                  <span className="font-semibold">Error</span>
                </div>
                <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 p-4 space-y-3">
            {/* Botón de WhatsApp (guarda en DB y abre WhatsApp) */}
            <button
              onClick={confirmOrder}
              disabled={isSubmitting || submitStatus === 'success'}
              className="w-full bg-rojo py-3 font-semibold text-crema hover:bg-rojo-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center gap-2">
                  <Clock size={16} className="animate-spin" />
                  Guardando...
                </div>
              ) : submitStatus === 'success' ? (
                '✅ Enviado'
              ) : (
                <>
                  <CheckCircle size={18} />
                  Confirmar pedido
                  {currentLocation && service === 'domicilio' && (
                    <span className="text-xs">📍</span>
                  )}
                </>
              )}
            </button>

            <p className="text-center text-xs text-gray-500">
              {currentLocation && service === 'domicilio' ? (
                '📍 Tu ubicación quedará asociada al pedido'
              ) : (
                'Al crear el pedido aceptas nuestros términos y condiciones'
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
