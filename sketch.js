// VARIABILI GLOBALI 

let table;               // tabella caricata dal CSV
let items = [];          // un oggetto per ogni paese/evento
let hovered = null;      // cerchio sotto il mouse
let selected = null;     // cerchio cliccato (card dettagli)

const DIAMETRO_MIN = 6;  // diametro del cerchio più piccolo
const DIAMETRO_MAX = 60; // diametro del cerchio più grande
const DISTANZA_MIN = 4;  // spazio minimo tra due cerchi

// apertura della pagina
async function setup() {
  // Il canvas occupa tutta la finestra.
  createCanvas(windowWidth, windowHeight);

  // Carica il CSV in modo asincrono. Quando è pronto,
  // la funzione passata come quarto parametro chiama processData().
  loadTable('assets/famines.csv', 'csv', 'header', (loadedTable) => {
    table = loadedTable;
    processData();
  });
}

//PREPARAZIONE DEI DATI

// Trasforma le righe del CSV in oggetti pronti per il disegno
function processData() {
  const rows = table.getRows();
  items = [];

  // Primo giro: trova la mortalità minima e massima, che servono a riscalare i diametri
  let minMortality = Infinity;
  let maxMortality = 0;

  for (const r of rows) {
    const m = r.getNum("Excess Mortality midpoint") || 0;
    if (m < minMortality) minMortality = m;
    if (m > maxMortality) maxMortality = m;
  }

  // Secondo giro: crea un oggetto per ogni riga
  for (const r of rows) {
    const mortality = r.getNum("Excess Mortality midpoint") || 0;
    items.push({
      country: r.getString("Country") || "Sconosciuto",
      mortality: mortality,
      duration: r.getNum("duration") || 1,
      x: 0,       
      y: 0,
      diameter: calcolaDiametro(mortality, minMortality, maxMortality)
    });
  }

  // Ordina dal più grave al meno grave
  // I cerchi grandi vengono piazzati per primi, così trovano spazio libero
  items.sort((a, b) => b.mortality - a.mortality);

  // Infine calcola le posizioni di tutti i cerchi
  calculateCircularLayout();
}

// CALCOLO DEI DIAMETRI

// Converte la mortalità in un diametro.
// Si usa la radice quadrata: l'AREA del cerchio cresce in modo proporzionale alla mortalità, e non il diametro. Così un cerchio con il doppio dei morti
// ha un'area doppia, non un diametro doppio
function calcolaDiametro(valore, minimo, massimo) {
  if (massimo <= minimo) return DIAMETRO_MIN;

  // t va da 0 (valore minimo) a 1 (valore massimo)
  const t = (Math.sqrt(valore) - Math.sqrt(minimo)) /
            (Math.sqrt(massimo) - Math.sqrt(minimo));

  // Riporta t nell'intervallo [DIAMETRO_MIN, DIAMETRO_MAX]
  return DIAMETRO_MIN + Math.max(0, Math.min(1, t)) * (DIAMETRO_MAX - DIAMETRO_MIN);
}

//POSIZIONAMENTO SENZA SOVRAPPOSIZIONI 

// Dispone i cerchi lungo una circonferenza, uno dopo l'altro
function calculateCircularLayout() {
  if (items.length === 0) return;

  const centerX = width / 2 + 60;  // centro spostato a destra, per fare spazio alla legenda
  const centerY = height / 2;
  const raggioBase = Math.min(width, height) * 0.35;
  const posizionati = [];   // cerchi già sistemati

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // I cerchi si distribuiscono in cerchio, partendo dall'alto
    const angoloIdeale = (i / items.length) * Math.PI * 2 - Math.PI / 2;

    // Cerca una posizione libera vicina a quella ideale
    const pos = trovaPosizioneLibera(
      centerX, centerY, raggioBase, angoloIdeale, item.diameter, posizionati
    );

    item.x = pos.x;
    item.y = pos.y;
    posizionati.push(item); // lo segna come occupato per i cerchi successivi
  }
}

// Cerca il punto libero più vicino alla posizione ideale
// 1) Prova a spostarsi lungo la circonferenza (ruotando da un lato e dall'altro)
// 2) Se non trova spazio, aumenta il raggio: il cerchio si sposta verso l'esterno
function trovaPosizioneLibera(cx, cy, raggioBase, angoloIdeale, diametro, posizionati) {
  for (let r = raggioBase; ; r += 2) {   // raggio che cresce di 2 px a ogni giro
    const passo = 2 / r;         

    // Prova prima l'angolo ideale, poi angoli sempre più lontani da entrambi i lati
    for (let k = 0; k * passo <= Math.PI; k++) {
      const versi = k === 0 ? [1] : [1, -1];   // +1 = avanti, -1 = indietro

      for (const verso of versi) {
        const a = angoloIdeale + verso * k * passo;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;

        // Se il punto è libero, lo restituisce e la ricerca finisce
        if (spazioLibero(x, y, diametro, posizionati)) {
          return { x: x, y: y };
        }
      }
    }
  }
}

// Controlla che un cerchio in (x, y) non tocchi nessuno di quelli già posizionati
// Due cerchi non si toccano se la distanza tra i centri è maggiore della somma dei raggi
// più lo spazio minimo DISTANZA_MIN.
function spazioLibero(x, y, diametro, posizionati) {
  for (const p of posizionati) {
    const distanzaMinima = (diametro + p.diameter) / 2 + DISTANZA_MIN;
    if (dist(x, y, p.x, p.y) < distanzaMinima) return false;
  }
  return true;
}

// DISEGNO 
function draw() {
  background(16, 16, 20);

  // Finché il CSV non è caricato, mostra un messaggio.
  if (!table) {
    fill(255);
    textSize(16);
    textAlign(CENTER, CENTER);
    text("Caricamento dati in corso...", width / 2, height / 2);
    return;
  }

  drawLegend();

  for (const item of items) {
    // Il cerchio è evidenziato se è sotto il mouse o selezionato
    const evidenziato = hovered === item || selected === item;

    const intensita = Math.min(item.mortality / 15000000, 1);
    const verde = Math.floor(180 - intensita * 130);

    fill(240, verde, 40);
    stroke(evidenziato ? 255 : 40);    
    strokeWeight(evidenziato ? 2 : 1);
    circle(item.x, item.y, item.diameter);
  }
}

// Disegna il riquadro con la spiegazione della visualizzazione
function drawLegend() {
  push();
  translate(40, 40);

  // Sfondo del riquadro
  fill(24, 24, 32);
  stroke(40, 40, 55);
  rect(0, 0, 260, 200, 6);

  // Titolo
  noStroke();
  fill(255);
  textSize(15);
  textStyle(BOLD);
  text("VISIONE CIRCOLARE CARESTIE", 20, 30);

  // Le tre regole di codifica
  textSize(12);
  textStyle(NORMAL);

  fill(255, 122, 69);
  text("• Circonferenza:", 20, 65);
  fill(180);
  text("  Eventi ordinati per gravità", 20, 82);

  fill(255, 122, 69);
  text("• Dimensione del cerchio:", 20, 115);
  fill(180);
  text("  Area proporzionale alla mortalità", 20, 132);

  fill(255, 122, 69);
  text("• Colore:", 20, 165);
  fill(180);
  text("  Intensità (Alto → Basso)", 20, 182);

  pop();
}

// INTERAZIONE CON IL MOUSE

// Chiamata ogni volta che il mouse si muove
function mouseMoved() {
  // Cerca il cerchio sotto il mouse. Un cerchio è "colpito" se il mouse è dentro il raggio più un margine di 4 px
  hovered = null;
  for (const item of items) {
    if (dist(mouseX, mouseY, item.x, item.y) < item.diameter / 2 + 4) {
      hovered = item;
      break;
    }
  }

  // Mostra o nasconde il tooltip con il nome del paese
  const tooltip = document.getElementById('tooltip');
  if (hovered) {
    cursor('pointer');
    tooltip.style.display = 'block';
    tooltip.style.left = (mouseX + 12) + 'px';
    tooltip.style.top = (mouseY - 20) + 'px';
    tooltip.innerHTML = `<strong>${hovered.country}</strong>`;
  } else {
    cursor('default');
    tooltip.style.display = 'none';
  }
}

// Se c'è un cerchio sotto il mouse, apre la card con i dettagli
function mousePressed() {
  if (hovered) {
    selected = hovered;
    document.getElementById('card-country').innerText = selected.country;
    document.getElementById('card-mortality').innerText = selected.mortality.toLocaleString();
    document.getElementById('card-duration').innerText = selected.duration;
    document.getElementById('info-card').style.display = 'block';
  }
}

// RIDIMENSIONAMENTO
// Chiamata quando la finestra cambia dimensione: adatta il canvas e ricalcola le posizioni, perché dipendono dalla larghezza e dall'altezza
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  calculateCircularLayout();
}