const entrada = "";
const ceviche = "";
const pescado = "";
const arroz = "";
const camaron = "";
const cazuela = "";
const encocado = "";
const otros = "";

export type CartaCategory = {
  id: string;
  name: string;
  description: string;
  products: { name: string; price: string; description: string; image: string }[];
};

let imageNumber = 0;
const product = (name: string, price: string, description: string, imageHint: string) => {
  void imageHint;
  imageNumber += 1;
  const extension = imageNumber <= 10 || (imageNumber >= 21 && imageNumber <= 30) ? "png" : "jpg";
  return { name, price, description, image: `/carta/${String(imageNumber).padStart(2, "0")}.${extension}` };
};

export const CARTA: CartaCategory[] = [
  { id: "entradas", name: "Entradas", description: "Sabores tradicionales para abrir el apetito.", products: [
    product("Patacones con hogao", "$15.000", "Patacones crujientes acompañados de hogao de la casa.", entrada),
    product("Croquetas de papachina", "$15.000", "Croquetas doradas de papachina, suaves por dentro.", arroz),
    product("Tostones de plátano verde", "$15.000", "Bocados de plátano verde, crocantes y recién preparados.", otros),
    product("Carantanta con hogao", "$15.000", "Tradicional carantanta caucana acompañada de hogao.", ceviche),
  ]},
  { id: "ceviches", name: "Ceviches y cócteles", description: "Frescos, cítricos y con todo el sabor del Pacífico.", products: [
    product("Ceviche de camarón", "$30.000", "Camarón, limón, cebolla, cilantro y especias.", ceviche),
    product("Ceviche mixto", "$40.000", "Mezcla de mariscos frescos en preparación cítrica.", cazuela),
    product("Ceviche de pescado", "$30.000", "Pescado marinado en limón con cebolla y cilantro.", pescado),
    product("Cóctel de camarón", "$50.000", "Camarones en salsa de la casa, acompañado de galletas.", camaron),
  ]},
  { id: "pescados", name: "Pescados", description: "Preparaciones del Pacífico con acompañamientos de la casa.", products: [
    product("Pescado frito del Pacífico", "$35.000 · $40.000 · $45.000", "Tres presentaciones. Incluye arroz, patacones y ensalada.", pescado),
    product("Pescado en salsa de coco", "$40.000", "Pescado bañado en cremosa salsa de coco.", encocado),
    product("Pescado en salsa de camarones", "$45.000", "Pescado acompañado de camarones en salsa de la casa.", camaron),
    product("Pescado a la plancha", "$30.000", "Filete a la plancha con guarniciones frescas.", arroz),
    product("Tapao de pescado", "$35.000", "Preparación tradicional del Pacífico llena de sabor.", otros),
    product("Sancocho de pescado", "$30.000", "Sancocho reconfortante con pescado y productos de la región.", cazuela),
  ]},
  { id: "arroces", name: "Arroces", description: "Arroces abundantes preparados al momento.", products: [
    product("Arroz marinero", "$40.000", "Arroz sazonado con una selección de frutos del mar.", arroz),
    product("Arroz con camarones", "$40.000", "Arroz salteado con camarones y vegetales.", camaron),
    product("Arroz con langostinos", "$45.000", "Arroz especial con langostinos y especias.", ceviche),
    product("Arroz mixto", "$40.000", "Combinación de carnes, mariscos y vegetales.", otros),
    product("Arroz con pollo", "$30.000", "Clásico arroz con pollo y vegetales frescos.", entrada),
  ]},
  { id: "camarones", name: "Camarones y langostinos", description: "Del mar a la mesa en preparaciones llenas de carácter.", products: [
    product("Langostinos apanados", "$40.000", "Langostinos crujientes con acompañamientos de la casa.", camaron),
    product("Camarones al coco", "$40.000", "Camarones en una suave salsa de coco.", encocado),
    product("Camarones al ajillo", "$40.000", "Camarones salteados con ajo y especias.", ceviche),
    product("Pastas con camarones", "$35.000", "Pasta en salsa cremosa acompañada de camarones.", arroz),
  ]},
  { id: "cazuelas", name: "Cazuelas", description: "Cremosas, calientes y servidas con acompañamientos.", products: [
    product("Cazuela de mariscos", "$40.000", "Selección de mariscos en salsa tradicional.", cazuela),
    product("Cazuela de langostinos", "$45.000", "Langostinos en una salsa cremosa y aromática.", camaron),
    product("Cazuela de pescado", "$40.000", "Pescado en preparación caliente con sabores del Pacífico.", pescado),
  ]},
  { id: "encocados", name: "Encocados", description: "El coco y los productos del Pacífico como protagonistas.", products: [
    product("Encocado mixto", "$40.000", "Pescado y mariscos en salsa de coco con hierbas.", encocado),
    product("Encocado de langostino", "$45.000", "Langostinos en salsa de coco y especias.", camaron),
    product("Encocado de almeja", "$40.000", "Almejas preparadas en la tradicional salsa de coco.", cazuela),
    product("Encocado de calamar", "$45.000", "Calamar en salsa de coco con sazón del Pacífico.", ceviche),
    product("Encocado de jaiba", "$45.000", "Jaiba en una preparación cremosa y tradicional.", pescado),
    product("Encocado de pateburro", "$40.000", "Producto del Pacífico cocinado en salsa de coco.", otros),
    product("Encocado de piangua", "$40.000", "Piangua en salsa de coco, hierbas y especias.", entrada),
    product("Encocado de tollo", "$35.000", "Tollo preparado en encocado tradicional.", arroz),
  ]},
  { id: "otros", name: "Otros platos", description: "Opciones colombianas y platos para compartir.", products: [
    product("Bandeja paisa", "$40.000", "Una selección completa de sabores tradicionales colombianos.", otros),
    product("Costilla tradicional", "$30.000", "Costilla tierna preparada con sazón de la casa.", entrada),
    product("Costilla ahumada", "$30.000", "Costilla de sabor profundo y acabado ahumado.", pescado),
    product("Picada", "$30.000", "Variedad de carnes y acompañamientos para compartir.", arroz),
  ]},
];
