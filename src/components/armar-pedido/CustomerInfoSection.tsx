import { useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { User, Phone, MapPin, Truck, Store, CreditCard, Banknote, MessageSquare, Navigation, X, CheckCircle2, Search, ExternalLink, History, Plus, Cake, Mail } from "lucide-react";

import type { Barrio } from "../../data/barrios";
import type { PaymentMethod, Service } from "../../lib/whatsapp";
import { cop } from "../../lib/format";
import { LocationService } from "../../services/locationService";
import { type ClientAddress } from "../../services/clientService";
import { Timestamp } from "firebase/firestore";
import { useContactLookup } from "../../hooks/useContactLookup";
import { isBirthdayToday, toBirthdayKey } from "../../lib/birthday";

export type CustomerInfoField = "name" | "phone" | "barrio" | "address" | "tableNumber";
export type CustomerInfoErrors = Record<CustomerInfoField, boolean>;
export type CustomerInfoFocusRequest = { field: CustomerInfoField; id: number } | null;

export type LocationState = {
  lat: number;
  lng: number;
  accuracy?: number;
  mapsLink: string;
  timestamp?: number;
} | null;

type SubStep = "servicio" | "personal" | "entrega" | "pago";

function StepHeader({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-2.5 mb-4 text-center">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white">
        {n}
      </span>
      <h3 className="text-base sm:text-lg font-semibold text-gray-900 leading-tight">{children}</h3>
    </div>
  );
}

function NextButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex justify-end border-t border-gray-100 pt-5">
      <button
        type="button"
        onClick={onClick}
        className="min-h-11 w-full rounded-full bg-rojo px-5 text-sm font-medium text-crema transition-colors hover:bg-rojo-dark active:bg-rojo-dark sm:w-auto"
      >
        Siguiente <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}

function BackNextButtons({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div className="flex gap-2 border-t border-gray-100 pt-5">
      <button
        type="button"
        onClick={onBack}
        className="min-h-11 rounded-full border border-stone-300 px-5 text-sm font-medium text-stone-700 transition-colors hover:border-rojo hover:text-rojo"
      >
         Atrás
      </button>
      <button
        type="button"
        onClick={onNext}
        className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-rojo px-5 text-sm font-medium text-crema transition-colors hover:bg-rojo-dark active:bg-rojo-dark"
      >
        Siguiente <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}

type Props = {
  name: string;
  phone: string;
  setName: (value: string) => void;
  setPhone: (value: string) => void;
  birthday: string;
  setBirthday: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  service: Service;
  setService: (value: Service) => void;
  tableNumber: string;
  setTableNumber: (value: string) => void;
  barrio: Barrio | null;
  setBarrio: (value: Barrio | null) => void;
  barrioQuery: string;
  setBarrioQuery: (value: string) => void;
  address: string;
  setAddress: (value: string) => void;
  reference: string;
  setReference: (value: string) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (value: PaymentMethod) => void;
  comments: string;
  setComments: (value: string) => void;
  deliverySectionEnabled: boolean;
  filteredBarrios: Barrio[];
  totalBarrios: number;
  nequiPhone: string;
  showErrors: boolean;
  errors: CustomerInfoErrors;
  focusRequest: CustomerInfoFocusRequest;
  onFocusRequestConsumed: () => void;
  onComplete: () => void;
  location: LocationState;
  onLocationChange: (loc: LocationState) => void;
};

export default function CustomerInfoSection({
  name,
  phone,
  setName,
  setPhone,
  birthday,
  setBirthday,
  email,
  setEmail,
  service,
  setService,
  tableNumber,
  setTableNumber,
  barrio,
  setBarrio,
  barrioQuery,
  setBarrioQuery,
  address,
  setAddress,
  reference,
  setReference,
  paymentMethod,
  setPaymentMethod,
  comments,
  setComments,
  deliverySectionEnabled,
  filteredBarrios,
  totalBarrios,
  nequiPhone,
  showErrors,
  errors,
  focusRequest,
  onFocusRequestConsumed,
  onComplete,
  location,
  onLocationChange,
}: Props) {
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<ClientAddress[]>([]);
  const [clientFound, setClientFound] = useState(false);
  const [addingNewAddress, setAddingNewAddress] = useState(false);
  const lookupLoading = useContactLookup(phone, contact => {
    setClientFound(true);
    if (!name.trim() && contact.name && contact.name !== "Cliente") setName(contact.name);
    if (!birthday && contact.birthday) setBirthday(`2000-${contact.birthday}`);
    if (!email.trim() && contact.email) setEmail(contact.email);
    setSavedAddresses((contact.addresses || []).map(addr => ({ ...addr, lastUsed: Timestamp.fromDate(new Date(addr.lastUsed || Date.now())) })));
  });

  const [subStep, setSubStep] = useState<SubStep>("servicio");
  const [subStepAttempted, setSubStepAttempted] = useState(false);
  const sectionTopRef = useRef<HTMLDivElement | null>(null);
  const prevSubStepRef = useRef<SubStep>("servicio");

  const visibleSubSteps: SubStep[] = deliverySectionEnabled ? ["servicio", "personal", "entrega", "pago"] : ["servicio", "personal", "pago"];
  const effectiveSubStep: SubStep = subStep === "entrega" && !deliverySectionEnabled ? "pago" : subStep;
  const subStepPosition = visibleSubSteps.indexOf(effectiveSubStep) + 1;
  const showFieldErrors = showErrors || subStepAttempted;

  const handleShareLocation = useCallback(async () => {
    setLocationLoading(true);
    setLocationError(null);
    try {
      const loc = await LocationService.getCurrentLocation();
      const mapsLink = LocationService.generateMapsLink(loc);
      onLocationChange({ lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy, mapsLink, timestamp: loc.timestamp });
    } catch (err: unknown) {
      setLocationError(err instanceof Error ? err.message : "No se pudo obtener la ubicación");
    } finally {
      setLocationLoading(false);
    }
  }, [onLocationChange]);

  const handleRemoveLocation = useCallback(() => {
    onLocationChange(null);
    setLocationError(null);
  }, [onLocationChange]);

  // Si el usuario cambia el tipo de servicio y deja de aplicar domicilio
  // mientras está en ese sub-paso, lo mandamos directo a pago.
  useEffect(() => {
    if (!deliverySectionEnabled && subStep === "entrega") {
      setSubStep("pago");
    }
  }, [deliverySectionEnabled, subStep]);

  // Scroll hacia el inicio de la sección cada vez que cambia el sub-paso,
  // para que se sienta como pasar a otra página.
  useEffect(() => {
    if (prevSubStepRef.current === effectiveSubStep) return;
    prevSubStepRef.current = effectiveSubStep;
    const timeout = window.setTimeout(() => {
      sectionTopRef.current?.focus({ preventScroll: true });
      sectionTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
    }, 60);
    return () => window.clearTimeout(timeout);
  }, [effectiveSubStep]);

  // Si el error que originó el intento de avanzar ya se corrigió, ocultamos el aviso.
  useEffect(() => {
    if (!subStepAttempted) return;
    if (effectiveSubStep === "servicio" && !errors.tableNumber) setSubStepAttempted(false);
    if (effectiveSubStep === "personal" && !errors.name && !errors.phone) setSubStepAttempted(false);
    if (effectiveSubStep === "entrega" && !errors.barrio && !errors.address) setSubStepAttempted(false);
  }, [errors, subStepAttempted, effectiveSubStep]);

  const goNextSubStep = () => {
    if (effectiveSubStep === "servicio") {
      if (service === "local" && !tableNumber) { setSubStepAttempted(true); return; }
      setSubStepAttempted(false);
      setSubStep("personal");
      return;
    }
    if (effectiveSubStep === "personal") {
      if (lookupLoading) return;
      if (errors.name || errors.phone) {
        setSubStepAttempted(true);
        const fieldId = errors.name ? "customer-name" : "customer-phone";
        window.setTimeout(() => {
          const element = document.getElementById(fieldId);
          element?.focus({ preventScroll: true });
          element?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 0);
        return;
      }
      setSubStepAttempted(false);
      setSubStep(deliverySectionEnabled ? "entrega" : "pago");
      return;
    }
    if (effectiveSubStep === "entrega") {
      if (errors.barrio || errors.address) {
        setSubStepAttempted(true);
        const fieldId = errors.barrio ? "customer-barrio-search" : "customer-address";
        window.setTimeout(() => {
          const element = document.getElementById(fieldId);
          element?.focus({ preventScroll: true });
          element?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 0);
        return;
      }
      setSubStepAttempted(false);
      setSubStep("pago");
    }
  };

  const goBackSubStep = () => {
    setSubStepAttempted(false);
    if (effectiveSubStep === "pago") {
      setSubStep(deliverySectionEnabled ? "entrega" : "personal");
      return;
    }
    if (effectiveSubStep === "entrega") {
      setSubStep("personal");
      return;
    }
    if (effectiveSubStep === "personal") {
      setSubStep("servicio");
    }
  };

  useEffect(() => {
    if (!focusRequest) return;

    const fieldToSubStep: Record<CustomerInfoField, SubStep> = {
      name: "personal",
      phone: "personal",
      barrio: "entrega",
      address: "entrega",
      tableNumber: "servicio",
    };
    const targetSubStep = fieldToSubStep[focusRequest.field];
    const needsSwitch = targetSubStep !== effectiveSubStep;
    if (needsSwitch) {
      setSubStepAttempted(false);
      setSubStep(targetSubStep);
    }

    const fieldToId: Record<CustomerInfoField, string> = {
      name: "customer-name",
      phone: "customer-phone",
      barrio: "customer-barrio-search",
      address: "customer-address",
      tableNumber: "customer-table",
    };

    const timeout = window.setTimeout(() => {
      const element = document.getElementById(fieldToId[focusRequest.field]);
      if (element instanceof HTMLElement) {
        element.focus({ preventScroll: true });
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      onFocusRequestConsumed();
    }, needsSwitch ? 120 : 0);

    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest, onFocusRequestConsumed]);

  const hasErrors = Object.values(errors).some(Boolean);

  const labelClass = (errored: boolean) =>
    `text-xs font-semibold uppercase tracking-wider sm:text-xs ${errored ? "text-red-600" : "text-gray-500"}`;

  const inputClass = (errored: boolean) =>
    [
      "mt-1.5 w-full rounded-lg border bg-white px-3 py-2.5 text-base sm:text-sm outline-none transition",
      errored
        ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200"
        : "border-gray-200 focus:border-gray-400 focus:ring-2 focus:ring-gray-200",
    ].join(" ");

  return (
    <section tabIndex={-1} ref={sectionTopRef} className="scroll-mt-24 pt-0 sm:pt-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-lg font-semibold text-gray-900">Datos y envío</h2>
        <p className="mt-1 text-sm text-gray-500">
          Completa tus datos para que podamos contactarte y entregar sin contratiempos.
        </p>
      </div>

      {/* Progreso del sub-paso actual */}
      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-1.5">
          {visibleSubSteps.map((s, i) => (
            <div
              key={s}
              className={[
                "h-1.5 flex-1 rounded-full transition-colors",
                i <= subStepPosition - 1 ? "bg-rojo" : "bg-gray-200",
              ].join(" ")}
            />
          ))}
        </div>
        <span className="shrink-0 text-xs font-medium text-gray-600">
          Paso {subStepPosition} de {visibleSubSteps.length}
        </span>
      </div>

      {showFieldErrors && hasErrors ? (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          <X size={16} className="shrink-0" />
          Completa los campos marcados para continuar.
        </div>
      ) : null}

      {effectiveSubStep === "servicio" ? (
        <div className="border-t border-gray-200 pt-5">
          <StepHeader n={1}>¿Cómo quieres recibir tu pedido?</StepHeader>
          <div className="divide-y divide-gray-200 border-y border-gray-200">
            {([
              { value: "local" as const, title: "Comer en La Tuba", detail: "Disfrutas tu pedido en el gastrobar", icon: Store },
              { value: "domicilio" as const, title: "Domicilio", detail: "Lo llevamos hasta tu ubicación", icon: Truck },
              { value: "llevar" as const, title: "Pasar a recoger", detail: "Lo prepararemos para que lo recojas", icon: Store },
            ]).map((option) => {
              const Icon = option.icon;
              const selected = service === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setService(option.value)}
                  className="flex w-full items-center gap-3 py-4 text-left"
                  aria-pressed={selected}
                >
                  <Icon size={21} className={selected ? "text-rojo" : "text-gray-600"} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-gray-900">{option.title}</span>
                    <span className="mt-0.5 block text-xs text-gray-500">{option.detail}</span>
                  </span>
                  <span className={`h-4 w-4 rounded-full border-2 ${selected ? "border-rojo bg-rojo" : "border-gray-300"}`} />
                </button>
              );
            })}
          </div>
          {service === "local" && <label className="my-4 block text-sm font-semibold text-rojo-dark">¿En qué mesa estás?<select id="customer-table" aria-label="Número de mesa" aria-invalid={showFieldErrors && errors.tableNumber} value={tableNumber} onChange={event => setTableNumber(event.target.value)} className="mt-2 block w-full border border-rojo/25 bg-white px-3 py-3 text-sm"><option value="">Selecciona tu mesa</option>{Array.from({ length: 7 }, (_, index) => <option key={index + 1} value={index + 1}>Mesa {index + 1}</option>)}</select>{showFieldErrors && errors.tableNumber && <span className="mt-1 block text-xs text-red-600">Selecciona tu mesa para continuar.</span>}</label>}
          <NextButton onClick={goNextSubStep} />
        </div>
      ) : null}

      {effectiveSubStep === "personal" ? (
        <>
          {/* Datos personales */}
          <div className="border-t border-gray-200 pt-5">
            <StepHeader n={2}>Primero, tu número de celular</StepHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="order-2">
                <label htmlFor="customer-name" className={labelClass(showFieldErrors && errors.name)}>
                  <User size={12} className="inline mr-1 -mt-0.5" />Nombre
                </label>
                <input
                  id="customer-name" autoComplete="name" aria-invalid={showFieldErrors && errors.name}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass(showFieldErrors && errors.name)}
                  placeholder="Tu nombre completo"
                />
                {showFieldErrors && errors.name ? (
                  <p className="mt-1 text-xs font-medium text-red-600">Falta ingresar tu nombre.</p>
                ) : null}
              </div>
              <div className="order-1">
                <label htmlFor="customer-phone" className={labelClass(showFieldErrors && errors.phone)}>
                  <Phone size={12} className="inline mr-1 -mt-0.5" />Teléfono
                </label>
                <input
                  id="customer-phone" type="tel" inputMode="tel" autoComplete="tel" aria-invalid={showFieldErrors && errors.phone}
                  value={phone}
                  onChange={(e) => { if (clientFound) { setName(""); setBirthday(""); setEmail(""); setSavedAddresses([]); setAddress(""); setBarrio(null); setBarrioQuery(""); setReference(""); setClientFound(false); } setPhone(e.target.value); }}
                  className={inputClass(showFieldErrors && errors.phone)}
                  placeholder="3xx xxx xxxx"
                />
                {showFieldErrors && errors.phone ? (
                  <p className="mt-1 text-xs font-medium text-red-600">Falta ingresar tu teléfono.</p>
                ) : null}
                {clientFound && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-rojo font-medium">
                    <CheckCircle2 size={12} />
                    Datos encontrados. Puedes revisarlos o modificarlos.
                  </div>
                )}
                {lookupLoading && <p className="mt-1 text-xs text-gray-500">Buscando tus datos…</p>}
              </div>

              <div className="order-3">
                <label htmlFor="customer-birthday" className="text-xs font-semibold uppercase tracking-wider text-gray-500 sm:text-xs">
                  <Cake size={12} className="inline mr-1 -mt-0.5" />Cumpleaños (opcional)
                </label>
                <input
                  id="customer-birthday"
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className={inputClass(false)}
                />
                {isBirthdayToday(toBirthdayKey(birthday)) && (
                  <div className="mt-2 rounded-lg border border-rojo/30 bg-rojo-light p-3">
                    <div className="flex items-center gap-1.5 text-xs text-rojo font-semibold">
                      🎂 ¡Feliz cumpleaños! Tienes un descuento especial esperándote.
                    </div>
                    <p className="mt-1.5 text-xs text-rojo/80">
                      Para reclamarlo, envíanos por WhatsApp una foto de tu cédula que coincida con el nombre de este pedido. Lo confirmamos por ahí.
                    </p>
                  </div>
                )}
              </div>

              <div className="order-4">
                <label htmlFor="customer-email" className="text-xs font-semibold uppercase tracking-wider text-gray-500 sm:text-xs">
                  <Mail size={12} className="inline mr-1 -mt-0.5" />Correo (opcional)
                </label>
                <input
                  id="customer-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass(false)}
                  placeholder="tucorreo@ejemplo.com"
                />
              </div>
            </div>
          </div>

          {/* Tipo de servicio */}
          <div className="hidden border-t border-gray-200 pt-5">
            <StepHeader n={2}>¿Cómo quieres recibirlo?</StepHeader>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setService("llevar")}
                aria-pressed={service === "llevar"}
                className={[
                  "relative rounded-xl border-2 px-4 py-4 text-left transition-all",
                  service === "llevar"
                    ? "border-rojo bg-rojo-light shadow-sm"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                ].join(" ")}
              >
                {service === "llevar" && (
                  <CheckCircle2 size={16} className="absolute top-3 right-3 text-rojo" />
                )}
                <Store size={20} className={service === "llevar" ? "text-rojo" : "text-gray-600"} />
                <div className="mt-2 text-sm font-semibold text-gray-900">Para llevar</div>
                <div className="mt-0.5 text-xs text-gray-500">Recoges en el punto acordado</div>
              </button>

              <button
                type="button"
                onClick={() => setService("domicilio")}
                aria-pressed={service === "domicilio"}
                className={[
                  "relative rounded-xl border-2 px-4 py-4 text-left transition-all",
                  service === "domicilio"
                    ? "border-rojo bg-rojo-light shadow-sm"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                ].join(" ")}
              >
                {service === "domicilio" && (
                  <CheckCircle2 size={16} className="absolute top-3 right-3 text-rojo" />
                )}
                <Truck size={20} className={service === "domicilio" ? "text-rojo" : "text-gray-600"} />
                <div className="mt-2 text-sm font-semibold text-gray-900">Domicilio</div>
                <div className="mt-0.5 text-xs text-gray-500">Te lo llevamos a tu barrio</div>
              </button>

              <button
                type="button"
                onClick={() => setService("local")}
                aria-pressed={service === "local"}
                className={[
                  "relative rounded-xl border-2 px-4 py-4 text-left transition-all",
                  service === "local"
                    ? "border-rojo bg-rojo-light shadow-sm"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                ].join(" ")}
              >
                {service === "local" && (
                  <CheckCircle2 size={16} className="absolute top-3 right-3 text-rojo" />
                )}
                <Store size={20} className={service === "local" ? "text-rojo" : "text-gray-600"} />
                <div className="mt-2 text-sm font-semibold text-gray-900">En el local</div>
                <div className="mt-0.5 text-xs text-gray-500">Consumes en nuestro local</div>
              </button>
            </div>
          </div>

          <NextButton onClick={goNextSubStep} />
        </>
      ) : null}

      {effectiveSubStep === "entrega" ? (
        <>
          {/* Sección domicilio */}
          <div className="border-t border-gray-200 pt-5 space-y-5">
            <StepHeader n={3}>¿A dónde lo llevamos?</StepHeader>

            {/* Direcciones guardadas - se muestran PRIMERO */}
            {savedAddresses.length > 0 && !addingNewAddress && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rojo-light">
                    <MapPin size={14} className="text-rojo" />
                  </div>
                  <label className="text-sm font-semibold text-gray-900">
                    Direcciones guardadas
                  </label>
                </div>
                <div className="mt-1.5 space-y-2">
                  {savedAddresses.map((addr, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setAddress(addr.direccion);
                        if (addr.referencia) setReference(addr.referencia);
                        if (addr.barrio) {
                          const matchedBarrio = filteredBarrios.find(b => b.name === addr.barrio)
                            || [...filteredBarrios, ...[]].find(b => b.name === addr.barrio);
                          if (matchedBarrio) {
                            setBarrio(matchedBarrio);
                          } else {
                            const found = filteredBarrios.find(b => b.name.toLowerCase() === addr.barrio!.toLowerCase());
                            if (found) setBarrio(found);
                          }
                        }
                        setAddingNewAddress(false);
                      }}
                      className={[
                        "w-full rounded-lg border px-3 py-3 text-left transition-all",
                        address === addr.direccion
                          ? "border-rojo bg-rojo-light shadow-sm"
                          : "border-gray-200 bg-white hover:border-gray-300",
                      ].join(" ")}
                    >
                      <div className="flex items-start gap-2.5">
                        <MapPin size={14} className={address === addr.direccion ? "text-rojo shrink-0 mt-0.5" : "text-gray-600 shrink-0 mt-0.5"} />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 text-sm">{addr.direccion}</div>
                          <div className="flex items-center gap-2 mt-1">
                            {addr.barrio && (
                              <span className={[
                                "text-xs font-medium px-2 py-0.5 rounded-full",
                                address === addr.direccion ? "bg-white text-rojo" : "bg-gray-100 text-gray-500",
                              ].join(" ")}>{addr.barrio}</span>
                            )}
                            {addr.referencia && (
                              <span className="text-xs text-gray-600 truncate">Ref: {addr.referencia}</span>
                            )}
                          </div>
                        </div>
                        {address === addr.direccion && (
                          <CheckCircle2 size={16} className="text-rojo shrink-0 mt-0.5" />
                        )}
                      </div>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => { setAddress(""); setReference(""); setBarrio(null); setAddingNewAddress(true); }}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-rojo hover:text-rojo-dark mt-2 transition-colors"
                  >
                    <Plus size={16} /> Agregar nueva dirección
                  </button>
                </div>
              </div>
            )}

            {/* Barrio - solo se muestra si NO hay direcciones guardadas o si está agregando nueva */}
            {(savedAddresses.length === 0 || addingNewAddress) && (
            <div>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <label htmlFor="customer-barrio-search" className={labelClass(showFieldErrors && errors.barrio)}>
                  <MapPin size={12} className="inline mr-1 -mt-0.5" />Barrio
                </label>
                <span className="text-xs text-gray-600">
                  Si no encuentras tu barrio, elige uno cercano.
                </span>
              </div>

              <div
                className={[
                  "mt-2 rounded-xl border p-3",
                  showFieldErrors && errors.barrio ? "border-red-300 bg-red-50/30" : "border-gray-200 bg-gray-50",
                ].join(" ")}
              >
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input
                    id="customer-barrio-search"
                    value={barrioQuery}
                    onChange={(e) => setBarrioQuery(e.target.value)}
                    className={[
                      "w-full rounded-lg border bg-white pl-9 pr-3 py-2.5 text-base sm:text-sm text-black outline-none transition",
                      showFieldErrors && errors.barrio
                        ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                        : "border-gray-200 focus:border-gray-400 focus:ring-2 focus:ring-gray-200",
                    ].join(" ")}
                    placeholder="Buscar barrio..."
                  />
                </div>

                <div className="mt-2 flex gap-2">
                  {barrio ? (
                    <button
                      type="button"
                      onClick={() => setBarrio(null)}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
                    >
                      <X size={12} /> Quitar
                    </button>
                  ) : null}
                  {barrioQuery ? (
                    <button
                      type="button"
                      onClick={() => setBarrioQuery("")}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
                    >
                      Ver todos
                    </button>
                  ) : null}
                </div>

                <div className="mt-2 max-h-52 space-y-1.5 overflow-y-auto">
                  {filteredBarrios.length ? (
                    filteredBarrios.map((b) => {
                      const selected = barrio?.id === b.id;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setBarrio(b)}
                          className={[
                            "w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-all",
                            selected
                              ? "border-gray-900 bg-white text-black shadow-sm"
                              : "border-gray-100 bg-white text-gray-700 hover:border-gray-300 hover:shadow-sm",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium">{b.name}</span>
                            <span className={`text-xs font-semibold ${selected ? "text-gray-900" : "text-gray-600"}`}>
                              {b.price == null ? "Por confirmar" : cop(b.price)}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-600">
                      No encontramos ese barrio. Verifica la ortografía o elige uno cercano.
                    </div>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
                  <span>{filteredBarrios.length}/{totalBarrios} barrios</span>
                  {barrio ? (
                    <span className="flex items-center gap-1 font-medium text-gray-700">
                      <CheckCircle2 size={12} className="text-rojo" /> {barrio.name}
                    </span>
                  ) : (
                    <span>Sin barrio seleccionado</span>
                  )}
                </div>
              </div>

              {/* Botón para volver a direcciones guardadas */}
              {showFieldErrors && errors.barrio ? (
                <p className="mt-1 text-xs font-medium text-red-600">Falta seleccionar tu barrio.</p>
              ) : null}

              {savedAddresses.length > 0 && addingNewAddress && (
                <button
                  type="button"
                  onClick={() => setAddingNewAddress(false)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 mt-2"
                >
                  <History size={12} /> Usar dirección guardada
                </button>
              )}
            </div>
            )}

            {/* Dirección y referencia - solo si no hay guardadas o está agregando nueva */}
            {(savedAddresses.length === 0 || addingNewAddress) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="customer-address" className={labelClass(showFieldErrors && errors.address)}>
                  <MapPin size={12} className="inline mr-1 -mt-0.5" />Dirección
                </label>
                <input
                  id="customer-address" autoComplete="street-address" aria-invalid={showFieldErrors && errors.address}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className={inputClass(showFieldErrors && errors.address)}
                  placeholder="Cra 7 # 12-34"
                />
                {showFieldErrors && errors.address ? (
                  <p className="mt-1 text-xs font-medium text-red-600">Falta ingresar tu dirección.</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="customer-reference" className="text-xs font-semibold uppercase tracking-wider text-gray-500 sm:text-xs">
                  Referencia (opcional)
                </label>
                <input
                  id="customer-reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-base sm:text-sm outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-200"
                  placeholder="Portón negro, edificio azul..."
                />
              </div>
            </div>
            )}

            {/* Ubicación */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 sm:text-xs">
                <Navigation size={12} className="inline mr-1 -mt-0.5" />Ubicación (opcional)
              </label>
              <p className="mt-0.5 text-xs text-gray-600">
                Comparte tu ubicación para que lleguemos más rápido.
              </p>

              {!location ? (
                <button
                  type="button"
                  onClick={handleShareLocation}
                  disabled={locationLoading}
                  className={[
                    "mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border text-xs font-semibold transition-all active:scale-[0.98]",
                    locationLoading
                      ? "border-gray-200 text-gray-300 cursor-wait"
                      : "border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:border-blue-300",
                  ].join(" ")}
                >
                  {locationLoading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400/30 border-t-blue-400" />
                      Obteniendo ubicación...
                    </>
                  ) : (
                    <>
                      <Navigation size={14} />
                      Compartir mi ubicación
                    </>
                  )}
                </button>
              ) : (
                <div className="mt-2 rounded-xl border border-rojo bg-rojo-light p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-rojo">
                      <CheckCircle2 size={14} />
                      Ubicación compartida
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveLocation}
                      className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-700 transition"
                    >
                      <X size={12} /> Quitar
                    </button>
                  </div>

                  {location.accuracy && (
                    <div className="mt-1.5 text-xs text-gray-500">
                      Precisión: ~{Math.round(location.accuracy)}m
                    </div>
                  )}

                  <a
                    href={location.mapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    <ExternalLink size={12} />
                    Ver en Google Maps
                  </a>
                </div>
              )}

              {locationError ? (
                <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                  {locationError}
                </div>
              ) : null}
            </div>
          </div>

          <BackNextButtons onBack={goBackSubStep} onNext={goNextSubStep} />
        </>
      ) : null}

      {effectiveSubStep === "pago" ? (
        <>
          {/* Pago */}
          <div className="border-t border-gray-200 pt-5">
            <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <StepHeader n={subStepPosition}>¿Cómo vas a pagar?</StepHeader>
              <div className="mb-4 shrink-0 text-xs text-gray-600">
                Nequi: <span className="font-semibold text-gray-700">{nequiPhone}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
              <button
                type="button"
                aria-pressed={paymentMethod === "Transferencia"} onClick={() => setPaymentMethod("Transferencia")}
                className={[
                  "relative flex items-center gap-2 rounded-xl border-2 px-4 py-3 text-left text-gray-900 transition-all",
                  paymentMethod === "Transferencia"
                    ? "border-rojo bg-rojo-light shadow-sm"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                ].join(" ")}
              >
                {paymentMethod === "Transferencia" && (
                  <CheckCircle2 size={14} className="absolute top-2 right-2 text-rojo" />
                )}
                <CreditCard size={16} className={paymentMethod === "Transferencia" ? "text-rojo" : "text-gray-600"} />
                <span className="text-sm font-medium">Transferencia</span>
              </button>

              <button
                type="button"
                aria-pressed={paymentMethod === "Efectivo"} onClick={() => setPaymentMethod("Efectivo")}
                className={[
                  "relative flex items-center gap-2 rounded-xl border-2 px-4 py-3 text-left text-gray-900 transition-all",
                  paymentMethod === "Efectivo"
                    ? "border-rojo bg-rojo-light shadow-sm"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                ].join(" ")}
              >
                {paymentMethod === "Efectivo" && (
                  <CheckCircle2 size={14} className="absolute top-2 right-2 text-rojo" />
                )}
                <Banknote size={16} className={paymentMethod === "Efectivo" ? "text-rojo" : "text-gray-600"} />
                <span className="text-sm font-medium">Efectivo</span>
              </button>
            </div>

            <div className="mt-4">
              <label htmlFor="comments" className="text-xs font-semibold uppercase tracking-wider text-gray-500 sm:text-xs">
                <MessageSquare size={12} className="inline mr-1 -mt-0.5" />Comentarios (opcional)
              </label>
              <textarea
                id="comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-base sm:text-sm outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-200 resize-none"
                rows={3}
                placeholder="Comentario general del pedido"
                aria-label="Comentarios adicionales (opcional)"
              />
            </div>
          </div>

          <BackNextButtons onBack={goBackSubStep} onNext={onComplete} />
        </>
      ) : null}
    </section>
  );
}
