import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation as useRouterLocation, useNavigate, useSearchParams } from "react-router-dom";
import type { Product } from "../data/products";
import { NEQUI_PHONE } from "../data/constants";
import { isFixedPrice } from "../data/products";
import { cop } from "../lib/format";
import { getBasePrice } from "../lib/pricing";
import { type PaymentMethod, type Service } from "../lib/whatsapp";

import ArmarPedidoHeader from "../components/armar-pedido/ArmarPedidoHeader";
import ProductConfigSection from "../components/armar-pedido/ProductConfigSection";
import { isItemConfigComplete } from "../components/armar-pedido/utils";
import CustomerInfoSection, {
  type CustomerInfoErrors,
  type CustomerInfoFocusRequest,
  type CustomerInfoField,
  type LocationState,
} from "../components/armar-pedido/CustomerInfoSection";
import OrderPricingSidebar from "../components/armar-pedido/OrderPricingSidebar";
import Stepper, { type Step } from "../components/armar-pedido/Stepper";
import CartDrawer from "../components/CartDrawer";
import { useOrderItems } from "../hooks/useOrderItems";
import { useBarrioSelection } from "../hooks/useBarrioSelection";
import { useOrderPricingValidation } from "../hooks/useOrderPricingValidation";
import { useStoreProducts } from "../hooks/useStoreProducts";
import { usePromotions } from "../hooks/usePromotions";
import { useToppingAvailability } from "../hooks/useToppingAvailability";
import { useModalFocus } from "../hooks/useModalFocus";

const STEP_SEQUENCE = ["productos", "configuracion", "datos", "resumen"] as const;
type StepId = (typeof STEP_SEQUENCE)[number];

const STEP_META: Record<StepId, { title: string; description: string }> = {
  productos: { title: "Elige", description: "Agrega productos" },
  configuracion: { title: "Personaliza", description: "Ajusta cada uno" },
  datos: { title: "Datos", description: "Tu info y envío" },
  resumen: { title: "Resumen", description: "Confirma y envía" },
};

export default function ArmarPedido() {
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthday, setBirthday] = useState("");
  const [email, setEmail] = useState("");
  const [service, setService] = useState<Service>("local");
  const [tableNumber, setTableNumber] = useState("");
  const [address, setAddress] = useState("");
  const [reference, setReference] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Transferencia");
  const [comments, setComments] = useState("");

  const { items, addProduct, updateItem, duplicateItem, removeItem } =
    useOrderItems();
  const { products: storeProducts } = useStoreProducts();
  const {
    barrio,
    setBarrio,
    barrioQuery,
    setBarrioQuery,
    filteredBarrios,
    deliverySectionEnabled,
    totalBarrios,
  } = useBarrioSelection(service);

  const { promotions } = usePromotions();
  const { disabledToppingIds } = useToppingAvailability();

  const [couponInput, setCouponInput] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  const handleApplyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    const match = promotions.find(
      (p) => p.activa && p.codigo && p.codigo.trim().toUpperCase() === code
    );
    if (!match) {
      setAppliedCouponCode(null);
      setCouponError("Cupón inválido o inactivo");
      return;
    }
    if (match.usosMaximos != null && (match.usosActuales ?? 0) >= match.usosMaximos) {
      setAppliedCouponCode(null);
      setCouponError("Este cupón ha caducado");
      return;
    }
    setAppliedCouponCode(code);
    setCouponError(null);
  };

  const handleRemoveCoupon = () => {
    setAppliedCouponCode(null);
    setCouponInput("");
    setCouponError(null);
  };

  const { pricedItems, subtotal, delivery, total, descuentoTotal, appliedPromotions, canSend, sendDisabledHint, validation } =
    useOrderPricingValidation({ items, service, barrio, address, name, phone, promotions, appliedCouponCode });

  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(() => items.length || routerLocation.pathname.startsWith("/armar/personalizar") ? 1 : 0);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const didMountRef = useRef(false);
  const focusSequenceRef = useRef(0);
  const manualProductCloseRef = useRef(false);
  const autoAddedProductRef = useRef<string | null>(null);
  const [showCustomerErrors, setShowCustomerErrors] = useState(false);
  const [showConfigWarning, setShowConfigWarning] = useState(false);
  const [focusRequest, setFocusRequest] = useState<CustomerInfoFocusRequest>(null);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [showBeverageOffer, setShowBeverageOffer] = useState(false);
  const beveragePanel = useRef<HTMLDivElement>(null);
  useModalFocus(showBeverageOffer, beveragePanel, () => setShowBeverageOffer(false));
  const [beverageOfferAnswered, setBeverageOfferAnswered] = useState(false);
  const beverages = storeProducts
    .filter(product => product.categoryId?.startsWith('bebida-') && product.category === 'frutafresh' && isFixedPrice(product.prices) && product.prices.fijo > 0)
    .sort((a, b) => getBasePrice(a, null, null) - getBasePrice(b, null, null) || a.name.localeCompare(b.name, 'es'));
  const hasBeverage = items.some(item => item.product.categoryId?.startsWith('bebida-'));
  const [submitRequested, setSubmitRequested] = useState(false);
  const [customerLocation, setCustomerLocation] = useState<LocationState>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 639px)");
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(event.matches);
    };

    handleChange(mq);
    mq.addEventListener("change", handleChange as (ev: MediaQueryListEvent) => void);
    return () => mq.removeEventListener("change", handleChange as (ev: MediaQueryListEvent) => void);
  }, []);

  const customerErrors = useMemo<CustomerInfoErrors>(() => {
    return {
      name: !name.trim(),
      phone: !/^\d{7,15}$/.test(phone.replace(/\D/g, '')),
      barrio: service === "domicilio" ? !barrio : false,
      address: service === "domicilio" ? !address.trim() : false,
      tableNumber: service === "local" ? !tableNumber : false,
    };
  }, [name, phone, service, barrio, address, tableNumber]);

  useEffect(() => {
    if (!showCustomerErrors) return;
    if (!Object.values(customerErrors).some(Boolean)) {
      const timer = window.setTimeout(() => setShowCustomerErrors(false), 0);
      return () => window.clearTimeout(timer);
    }
  }, [customerErrors, showCustomerErrors]);

  const requestFocusForField = (field: CustomerInfoField) => {
    focusSequenceRef.current += 1;
    setFocusRequest({ field, id: focusSequenceRef.current });
  };

  const consumeFocusRequest = () => {
    setFocusRequest(null);
  };

  const scrollToStepperTop = () => {
    const anchor = scrollAnchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const offset = window.innerWidth >= 1024 ? 104 : window.innerWidth >= 640 ? 88 : 72;
    const targetTop = Math.max(0, rect.top + window.scrollY - offset);
    window.scrollTo({ top: targetTop, behavior: "smooth" });
  };

  const handleFocusProduct = (itemId: string | null) => {
    if (itemId === null) {
      manualProductCloseRef.current = true;
      setActiveProductId(null);
      requestAnimationFrame(() => scrollToStepperTop());
    } else {
      manualProductCloseRef.current = false;
      setActiveProductId(itemId);
    }
  };

  const currentStepId = STEP_SEQUENCE[stepIndex];

  const handleAddProduct = (product: Product) => {
    manualProductCloseRef.current = true;
    addProduct(product);
    setActiveProductId(null);
    setStepIndex(1);
  };

  useEffect(() => {
    const requestedProductId = searchParams.get("producto");
    if (!requestedProductId || autoAddedProductRef.current === requestedProductId) return;
    const requestedProduct = storeProducts.find((product) => product.id === requestedProductId);
    if (!requestedProduct) return;

    const timer = window.setTimeout(() => {
      autoAddedProductRef.current = requestedProductId;
      handleAddProduct(requestedProduct);
      navigate("/armar", { replace: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [navigate, searchParams, storeProducts]);

  useEffect(() => {
    if (searchParams.get("carrito") !== "1" || !items.length) return;
    const timer = window.setTimeout(() => {
      setSubmitRequested(false);
      setStepIndex(1);
      navigate("/armar/personalizar", { replace: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [items.length, navigate, searchParams]);

  const handleRemoveItem = (itemId: string) => {
    removeItem(itemId);
    if (activeProductId === itemId) {
      setActiveProductId(null);
    }
  };

  useEffect(() => {
    let shouldClear = false;
    if (!items.length) {
      shouldClear = true;
    } else if (activeProductId && !items.some((it) => it.id === activeProductId)) {
      shouldClear = true;
    }
    if (!shouldClear) return;
    const timer = window.setTimeout(() => { setActiveProductId(null); if (!items.length) manualProductCloseRef.current = false; }, 0);
    return () => window.clearTimeout(timer);
  }, [items, activeProductId]);

  const { itemsOk, itemsConfigOk, customerOk, deliveryOk } = validation;

  useEffect(() => {
    if (showConfigWarning && itemsConfigOk) {
      const timer = window.setTimeout(() => setShowConfigWarning(false), 0);
      return () => window.clearTimeout(timer);
    }
  }, [showConfigWarning, itemsConfigOk]);

  useEffect(() => {
    let targetStep: number | null = null;
    if (currentStepId === "configuracion" && !itemsOk) {
      targetStep = 0;
    }

    if (targetStep === null && (currentStepId === "datos" || currentStepId === "resumen")) {
      if (!itemsOk) {
        targetStep = 0;
      } else if (!itemsConfigOk) {
        targetStep = 1;
      }
    }

    if (targetStep === null && currentStepId === "resumen") {
      if (!customerOk || !deliveryOk) {
        targetStep = 2;
      }
    }
    if (targetStep === null) return;
    const timer = window.setTimeout(() => setStepIndex(targetStep), 0);
    return () => window.clearTimeout(timer);
  }, [currentStepId, itemsOk, itemsConfigOk, customerOk, deliveryOk]);

  const handleSend = () => {
    if (!canSend || (service === "local" && !tableNumber)) return;
    setSubmitRequested(true);
    setCartDrawerOpen(true);
  };

  const handleClearCart = () => {
    items.forEach(item => removeItem(item.id));
    setActiveProductId(null);
    setStepIndex(0);
  };

  const canAdvanceFromStep = (id: StepId) => {
    switch (id) {
      case "productos":
        return items.length > 0;
      case "configuracion":
        return itemsConfigOk;
      case "datos":
        return customerOk && deliveryOk && (service !== "local" || !!tableNumber);
      case "resumen":
        return canSend;
      default:
        return false;
    }
  };

  const goToNextStep = () => {
    if (stepIndex >= STEP_SEQUENCE.length - 1) return;
    if (!canAdvanceFromStep(currentStepId)) {
      if (currentStepId === "configuracion") {
        setShowConfigWarning(true);
        const firstIncomplete = items.find((it) => !isItemConfigComplete(it));
        if (firstIncomplete) {
          manualProductCloseRef.current = false;
          setActiveProductId(firstIncomplete.id);
        }
      }
      if (currentStepId === "datos") {
        setShowCustomerErrors(true);
        const firstErrorEntry = Object.entries(customerErrors).find(([, hasError]) => hasError);
        if (firstErrorEntry) {
          requestFocusForField(firstErrorEntry[0] as CustomerInfoField);
        }
      }
      return;
    }
    setShowConfigWarning(false);
    if (currentStepId === 'configuracion' && !hasBeverage && !beverageOfferAnswered && beverages.length > 0) {
      setShowBeverageOffer(true);
      return;
    }
    setStepIndex((prev) => Math.min(prev + 1, STEP_SEQUENCE.length - 1));
  };

  const goToPreviousStep = () => {
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleSelectStep = (id: string) => {
    const targetIndex = STEP_SEQUENCE.indexOf(id as StepId);
    if (targetIndex === -1) return;
    if (targetIndex < stepIndex) setStepIndex(targetIndex);
  };

  const steps: Step[] = STEP_SEQUENCE.map((id, index) => {
    const status: Step["status"] = index < stepIndex ? "done" : index === stepIndex ? "current" : "todo";
    return { id, title: STEP_META[id].title, description: STEP_META[id].description, status };
  });

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    const anchor = scrollAnchorRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const offset = window.innerWidth >= 1024 ? 104 : window.innerWidth >= 640 ? 88 : 72;
    const targetTop = Math.max(0, rect.top + window.scrollY - offset);

    window.scrollTo({ top: targetTop, behavior: "smooth" });
  }, [stepIndex]);

  const footerCTA = (() => {
    const back =
      stepIndex > 0
        ? { label: "Atrás", onClick: goToPreviousStep, disabled: false }
        : { label: "Atrás", onClick: goToPreviousStep, disabled: true };

    if (currentStepId === "productos") {
      return {
        back,
        next: {
          label: "Personalizar",
          onClick: goToNextStep,
          disabled: !canAdvanceFromStep("productos"),
        },
      };
    }

    if (currentStepId === "configuracion") {
      return {
        back: { label: "Carta", onClick: () => navigate("/catalogo"), disabled: false },
        next: {
          label: "Datos",
          onClick: goToNextStep,
          disabled: !canAdvanceFromStep("configuracion"),
        },
      };
    }

    if (currentStepId === "datos") {
      return {
        back: { label: "Personalizar", onClick: () => setStepIndex(1), disabled: false },
        next: {
          label: "Ver resumen",
          onClick: goToNextStep,
          disabled: false,
        },
      };
    }

    return {
      back: { label: "Datos", onClick: () => setStepIndex(2), disabled: false },
      next: {
        label: "Confirmar pedido",
        onClick: handleSend,
        disabled: !canSend,
      },
    };
  })();

  const renderProductsStep = () => (
    <div className="py-10 text-center sm:py-16">
      <h2 className="mt-3 text-2xl text-rojo-dark sm:text-3xl" >Elige desde nuestra carta</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">Encuentra el plato que deseas y agrégalo directamente a tu pedido.</p>
      <Link to="/catalogo" className="mt-6 inline-flex min-h-11 items-center bg-rojo px-6 py-3 text-sm font-semibold text-crema">Ver nuestra carta</Link>
    </div>
  );

  const renderConfigStep = () => (
    <div className="space-y-5 sm:space-y-6">
      <ProductConfigSection
        items={items}
        updateItem={updateItem}
        duplicateItem={duplicateItem}
        removeItem={handleRemoveItem}
        activeProductId={activeProductId}
        onFocusProduct={handleFocusProduct}
        onGoToNext={goToNextStep}
        onAddAnotherProduct={() => navigate("/elegir-pedido")}
        showIncompleteWarning={showConfigWarning}
        disabledToppingIds={disabledToppingIds}
      />

      <div className="hidden sm:flex sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => navigate("/elegir-pedido")}
          className="border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-500 hover:border-gray-400 hover:text-black"
        >
          + Agregar más
        </button>

        <button
          type="button"
          onClick={goToNextStep}
          disabled={!canAdvanceFromStep("configuracion")}
          className={[
            "border border-gray-300 px-6 py-2 text-sm font-semibold transition",
            canAdvanceFromStep("configuracion") ? "text-black hover:border-black" : "text-gray-300 cursor-not-allowed",
          ].join(" ")}
        >
          Datos y envío
        </button>
      </div>
    </div>
  );

  const renderDatosStep = () => (
    <div className="space-y-6">
      <button type="button" onClick={goToPreviousStep} className="text-sm font-semibold text-rojo underline"> Volver al pedido</button>
      <CustomerInfoSection
        name={name}
        setName={setName}
        phone={phone}
        setPhone={setPhone}
        birthday={birthday}
        setBirthday={setBirthday}
        email={email}
        setEmail={setEmail}
        service={service}
        setService={setService}
        tableNumber={tableNumber}
        setTableNumber={setTableNumber}
        barrio={barrio}
        setBarrio={setBarrio}
        barrioQuery={barrioQuery}
        setBarrioQuery={setBarrioQuery}
        address={address}
        setAddress={setAddress}
        reference={reference}
        setReference={setReference}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        comments={comments}
        setComments={setComments}
        deliverySectionEnabled={deliverySectionEnabled}
        filteredBarrios={filteredBarrios}
        totalBarrios={totalBarrios}
        nequiPhone={NEQUI_PHONE}
        showErrors={showCustomerErrors}
        errors={customerErrors}
        focusRequest={focusRequest}
        onFocusRequestConsumed={consumeFocusRequest}
        onComplete={goToNextStep}
        location={customerLocation}
        onLocationChange={setCustomerLocation}
      />

      {/* Indicador de lo que falta */}
      {!canAdvanceFromStep("datos") && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Completa para continuar
          </div>
          <ul className="space-y-1.5">
            {customerErrors.name && (
              <li className="flex items-center gap-2 text-sm text-gray-600">
                <span className="text-rojo"></span> Falta tu nombre
              </li>
            )}
            {customerErrors.phone && (
              <li className="flex items-center gap-2 text-sm text-gray-600">
                <span className="text-rojo"></span> Falta tu teléfono
              </li>
            )}
            {service === "domicilio" && customerErrors.barrio && (
              <li className="flex items-center gap-2 text-sm text-gray-600">
                <span className="text-rojo"></span> Falta seleccionar un barrio
              </li>
            )}
            {service === "domicilio" && customerErrors.address && (
              <li className="flex items-center gap-2 text-sm text-gray-600">
                <span className="text-rojo"></span> Falta tu dirección
              </li>
            )}
            {customerErrors.tableNumber && <li className="flex items-center gap-2 text-sm text-gray-600"><span className="text-rojo"></span> Falta seleccionar tu mesa</li>}
          </ul>
        </div>
      )}

    </div>
  );

  const renderResumenStep = () => (
    <div className="space-y-6">
      <OrderPricingSidebar
        items={pricedItems}
        subtotal={subtotal}
        delivery={delivery}
        total={total}
        canSend={canSend}
        onSend={handleSend}
        onRemove={handleRemoveItem}
        sendDisabledHint={sendDisabledHint}
        descuentoTotal={descuentoTotal}
        appliedPromotions={appliedPromotions}
        couponInput={couponInput}
        onCouponInputChange={setCouponInput}
        onApplyCoupon={handleApplyCoupon}
        onRemoveCoupon={handleRemoveCoupon}
        appliedCouponCode={appliedCouponCode}
        couponError={couponError}
      />

      <div className="hidden sm:flex sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={goToPreviousStep}
          className="border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-500 hover:border-gray-400 hover:text-black"
        >
          Volver a datos
        </button>
      </div>
    </div>
  );

  const stepContent = (() => {
    switch (currentStepId) {
      case "productos":
        return renderProductsStep();
      case "configuracion":
        return renderConfigStep();
      case "datos":
        return renderDatosStep();
      case "resumen":
        return renderResumenStep();
      default:
        return null;
    }
  })();

  const mobileDetailMode = isMobile;
  const footerBackDisabled = stepIndex === 0;
  const footerNextDisabled = currentStepId === "productos" ? !canAdvanceFromStep("productos") : currentStepId === "configuracion" ? !canAdvanceFromStep("configuracion") : currentStepId === "resumen" ? !canSend : false;

  const desktopOrCatalogLayout = (
    <div className="bg-crema text-neutral-900 pt-0 sm:pt-20 lg:pt-24">
      <ArmarPedidoHeader selectedCount={items.length} />

      <div ref={scrollAnchorRef} className="mx-auto max-w-5xl px-4 pb-20 sm:pb-16">
        <div className="sticky top-[56px] z-40 -mx-4 px-4 py-1.5 bg-crema/95 backdrop-blur border-b border-gray-100 sm:static sm:top-auto sm:z-auto sm:-mx-0 sm:px-0 sm:py-0 sm:bg-transparent sm:backdrop-blur-0 sm:border-b-0">
          <Stepper steps={steps} onSelectStep={handleSelectStep} />
        </div>

        <div className="mt-3 sm:mt-8">{stepContent}</div>
      </div>
    </div>
  );

  const mobileDetailLayout = (
    <div className="bg-crema text-neutral-900 min-h-dvh flex flex-col">
      <div className="flex-1 px-4 pb-4 pt-[72px]">
        <p className="mb-3 text-center text-sm font-semibold text-rojo">
          {STEP_META[currentStepId].title}
        </p>
        {stepContent}
      </div>

      {currentStepId !== 'datos' && <div className="sticky bottom-0 z-40 flex items-center gap-2 border-t border-gray-200 bg-white px-4 py-3">
        <button
          type="button"
          onClick={footerCTA.back.onClick}
          disabled={footerCTA.back.disabled}
          className={[
            "flex-1 border px-3 py-2.5 text-xs font-medium",
            footerBackDisabled
              ? "border-gray-200 text-gray-300"
              : "border-gray-300 text-gray-600 active:bg-gray-100",
          ].join(" ")}
        >
          {footerCTA.back.label}
        </button>

        <button
          type="button"
          onClick={footerCTA.next.onClick}
          disabled={footerCTA.next.disabled}
          className={[
            "flex-[1.5] border px-3 py-2.5 text-xs font-medium",
            !footerNextDisabled
              ? currentStepId === "resumen"
                ? "border-rojo bg-rojo text-white active:bg-rojo-dark"
                : "border-rojo bg-rojo text-white active:bg-rojo-dark"
              : "border-gray-200 text-gray-300",
          ].join(" ")}
        >
          {footerCTA.next.label}
        </button>
      </div>}
    </div>
  );

  const cartDrawerInitialLocation = useMemo(() => {
    if (!customerLocation) return null;
    return {
      lat: customerLocation.lat,
      lng: customerLocation.lng,
      accuracy: customerLocation.accuracy,
      timestamp: customerLocation.timestamp ?? 0,
    };
  }, [customerLocation]);

  return (
    <>
      {mobileDetailMode ? mobileDetailLayout : desktopOrCatalogLayout}

      {showBeverageOffer && <div ref={beveragePanel} tabIndex={-1} className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="beverage-offer-title">
        <div className="flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden bg-crema p-5 shadow-xl sm:p-6">
          <h2 id="beverage-offer-title" className="font-serif text-2xl text-rojo-dark">¿Quieres llevar una bebida?</h2>
          <p className="mt-2 text-sm text-stone-600">Tu pedido está guardado. Puedes agregar una bebida o continuar sin ella.</p>
          <div className="mt-4 flex-1 divide-y divide-rojo/10 overflow-y-auto border-y border-rojo/15">
            {beverages.map(product => <div key={product.id} className="flex items-center gap-3 py-3"><div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden bg-crema-dark">{product.image ? <img src={product.image} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="text-[10px] font-semibold text-rojo/60">La Tuba</span>}</div><div className="min-w-0 flex-1"><b className="block text-sm">{product.name}</b>{product.category === 'frutafresh' && isFixedPrice(product.prices) && <span className="text-xs text-stone-600">{cop(product.prices.fijo)}</span>}</div><button type="button" onClick={() => addProduct(product)} aria-label={`Agregar ${product.name}`} className="min-h-10 border border-rojo px-3 text-sm font-semibold text-rojo">Agregar</button></div>)}
          </div>
          {hasBeverage && <p role="status" className="mt-3 text-sm font-semibold text-rojo">Bebida agregada a tu pedido.</p>}
          <button type="button" onClick={() => { setBeverageOfferAnswered(true); setShowBeverageOffer(false); setStepIndex(2); }} className="mt-4 min-h-11 bg-rojo px-4 py-3 text-sm font-semibold text-crema">{hasBeverage ? 'Continuar a mis datos' : 'Continuar sin bebida'}</button>
          <button type="button" onClick={() => setShowBeverageOffer(false)} className="mt-2 min-h-10 text-sm font-semibold text-stone-600">Volver al pedido</button>
        </div>
      </div>}

      <CartDrawer
        isOpen={cartDrawerOpen}
        autoSubmit={submitRequested}
        onClose={() => { setCartDrawerOpen(false); setSubmitRequested(false); }}
        items={pricedItems}
        subtotal={subtotal}
        delivery={delivery}
        total={total}
        descuentoTotal={descuentoTotal}
        appliedPromotions={appliedPromotions}
        couponInput={couponInput}
        onCouponInputChange={setCouponInput}
        onApplyCoupon={handleApplyCoupon}
        onRemoveCoupon={handleRemoveCoupon}
        appliedCouponCode={appliedCouponCode}
        couponError={couponError}
        name={name}
        phone={phone}
        birthday={birthday}
        email={email}
        service={service}
        tableNumber={tableNumber}
        barrio={barrio}
        address={address}
        reference={reference}
        paymentMethod={paymentMethod}
        comments={comments}
        initialLocation={cartDrawerInitialLocation}
        onClearCart={handleClearCart}
      />
    </>
  );
}
