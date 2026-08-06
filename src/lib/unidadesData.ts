export type Unidad = {
  eco: string;
  descripcion: string;
  placa: string;
  clave: string;
};

export const UNIDADES: Unidad[] = [
  {
    "eco": "ECO-06",
    "descripcion": "Volkswagen Transporter 2019",
    "placa": "6848-ZR",
    "clave": "C15"
  },
  {
    "eco": "ECO-07",
    "descripcion": "Volkswagen Transporter 2019",
    "placa": "6849-ZR",
    "clave": "C15"
  },
  {
    "eco": "ECO-08",
    "descripcion": "Volkswagen Transporter 2019",
    "placa": "6850-ZR",
    "clave": "C15"
  },
  {
    "eco": "ECO-09",
    "descripcion": "Volkswagen Transporter 2019",
    "placa": "6854-ZR",
    "clave": "C15"
  },
  {
    "eco": "ECO-10",
    "descripcion": "Volkswagen Transporter 2019",
    "placa": "6855-ZR",
    "clave": "C15"
  },
  {
    "eco": "ECO-11",
    "descripcion": "Mercedes-Benz Sprinter 2018",
    "placa": "7287ZP",
    "clave": "C15"
  },
  {
    "eco": "ECO-12",
    "descripcion": "Mercedes-Benz Sprinter 2018",
    "placa": "7783ZP",
    "clave": "C15"
  },
  {
    "eco": "ECO-13",
    "descripcion": "Mercedes-Benz Sprinter 2018",
    "placa": "7289ZP",
    "clave": "C15"
  },
  {
    "eco": "ECO-14",
    "descripcion": "Mercedes-Benz Sprinter 2018",
    "placa": "7302ZP",
    "clave": "C15"
  },
  {
    "eco": "ECO-15",
    "descripcion": "Volkswagen Transporter 2015",
    "placa": "5339ZP",
    "clave": "C15"
  },
  {
    "eco": "ECO-16",
    "descripcion": "Volkswagen Transporter 2016",
    "placa": "5340ZP",
    "clave": "C15"
  },
  {
    "eco": "ECO-19",
    "descripcion": "Volkswagen Transporter 2016",
    "placa": "LH22487",
    "clave": "C15"
  },
  {
    "eco": "ECO-22",
    "descripcion": "Volkswagen Transporter 2018",
    "placa": "6447ZP",
    "clave": "C15"
  },
  {
    "eco": "ECO-25",
    "descripcion": "Volkswagen Transporter 2017",
    "placa": "LD69844",
    "clave": "C15"
  },
  {
    "eco": "ECO-26",
    "descripcion": "Volkswagen Transporter 2017",
    "placa": "5964ZP",
    "clave": "C15"
  },
  {
    "eco": "ECO-27",
    "descripcion": "Volkswagen Transporter 2017",
    "placa": "5965-ZP",
    "clave": "C15"
  },
  {
    "eco": "ECO-29",
    "descripcion": "Volkswagen Transporter 2018",
    "placa": "LE-76451",
    "clave": "C15"
  },
  {
    "eco": "ECO-35",
    "descripcion": "Volkswagen Delivery 2022",
    "placa": "63-AX-2C",
    "clave": "C35"
  },
  {
    "eco": "ECO-36",
    "descripcion": "Volkswagen Delivery 2022",
    "placa": "64-AX-2C",
    "clave": "C35"
  },
  {
    "eco": "ECO-37",
    "descripcion": "Volkswagen Delivery 2022",
    "placa": "65AX2C",
    "clave": "C35"
  },
  {
    "eco": "ECO-38",
    "descripcion": "Volkswagen Delivery 2022",
    "placa": "66-AX-2C",
    "clave": "C35"
  },
  {
    "eco": "ECO-39",
    "descripcion": "Volkswagen Delivery 2022",
    "placa": "67-AX-2C",
    "clave": "C35"
  },
  {
    "eco": "ECO-65",
    "descripcion": "Freightliner Torthon 2018",
    "placa": "91AL3T",
    "clave": "THR"
  },
  {
    "eco": "ECO-69",
    "descripcion": "Freightliner Torthon 2018",
    "placa": "32-BJ-2T",
    "clave": "THR"
  },
  {
    "eco": "ECO-71",
    "descripcion": "Freightliner Torthon 2018",
    "placa": "90AL3T",
    "clave": "THR"
  },
  {
    "eco": "ECO-72",
    "descripcion": "Freightliner Torthon 2024",
    "placa": "50-BC-7V",
    "clave": "RAB"
  },
  {
    "eco": "ECO-73",
    "descripcion": "Freightliner Torthon 2024",
    "placa": "51-BC-7V",
    "clave": "RAB"
  },
  {
    "eco": "ECO-74",
    "descripcion": "Freightliner Torthon 2024",
    "placa": "52-BC-7V",
    "clave": "RAB"
  },
  {
    "eco": "ECO-75",
    "descripcion": "Freightliner Torthon 2024",
    "placa": "53-BC-7V",
    "clave": "RAB"
  }
];

export const DICTAMEN_OPCIONES = ["BUEN ESTADO", "MEDIA VIDA EN GENERAL"];

export function imagenLlantaPorClave(clave: string): string {
  if (clave === "C15" || clave === "C35") return "/llantas-c15.png";
  if (clave === "THR") return "/llantas-thr.png";
  if (clave === "RAB") return "/llantas-rab.png";
  return "";
}
