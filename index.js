/* ================================================================
   CHESS ENGINE
================================================================ */
const G = { wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙', bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟' };
let board, turn, sel, lvs = [], capW = [], capB = [], mhist = [], shist = [];
let lf = null, lt = null, flipped = false, over = false, ep = null;
let cr = { wK: true, wQ: true, bK: true, bQ: true };
let pending = null, gameMode = 'human', diff = 2, aiWorking = false;

const opp = c => c === 'w' ? 'b' : 'w';
const pc = p => p ? p[0] : null;
const pt = p => p ? p[1] : null;
const ib = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const cb = b => b.map(r => r.slice());
const cst = () => ({ board: cb(board), turn, capW: [...capW], capB: [...capB], mhist: [...mhist], lf, lt, ep, cr: { ...cr } });
const rst = s => { board = cb(s.board); turn = s.turn; capW = [...s.capW]; capB = [...s.capB]; mhist = [...s.mhist]; lf = s.lf; lt = s.lt; ep = s.ep; cr = { ...s.cr }; over = false };

function init() {
    board = Array(8).fill(null).map(() => Array(8).fill(null));
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'].forEach((t, c) => { board[0][c] = 'b' + t; board[7][c] = 'w' + t });
    for (let c = 0; c < 8; c++) { board[1][c] = 'bP'; board[6][c] = 'wP' }
    turn = 'w'; sel = null; lvs = []; capW = []; capB = []; mhist = []; shist = [];
    lf = null; lt = null; over = false; ep = null; cr = { wK: true, wQ: true, bK: true, bQ: true };
    pending = null; aiWorking = false; dragState = null;
}

function findK(b, col) { for (let r = 0; r < 8; r++)for (let c = 0; c < 8; c++)if (b[r][c] === col + 'K') return [r, c]; return null }

function atk(b, r, c, by) {
    const d = by === 'w' ? 1 : -1;
    for (const dc of [-1, 1]) { const pr = r + d, pc2 = c + dc; if (ib(pr, pc2) && b[pr][pc2] === by + 'P') return true }
    for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) { const nr = r + dr, nc = c + dc; if (ib(nr, nc) && b[nr][nc] === by + 'N') return true }
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { for (let i = 1; i < 8; i++) { const nr = r + dr * i, nc = c + dc * i; if (!ib(nr, nc)) break; if (b[nr][nc]) { const t = pt(b[nr][nc]); if (pc(b[nr][nc]) === by && (t === 'R' || t === 'Q')) return true; break } } }
    for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) { for (let i = 1; i < 8; i++) { const nr = r + dr * i, nc = c + dc * i; if (!ib(nr, nc)) break; if (b[nr][nc]) { const t = pt(b[nr][nc]); if (pc(b[nr][nc]) === by && (t === 'B' || t === 'Q')) return true; break } } }
    for (const [dr, dc] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) { const nr = r + dr, nc = c + dc; if (ib(nr, nc) && b[nr][nc] === by + 'K') return true }
    return false;
}
const chk = (b, col) => { const k = findK(b, col); return k ? atk(b, k[0], k[1], opp(col)) : false };

function raw(b, r, c, epp, crc) {
    const p = b[r][c]; if (!p) return [];
    const col = p[0], type = p[1]; const mv = [];
    const add = (tr, tc, f = {}) => { if (!ib(tr, tc) || pc(b[tr][tc]) === col) return; mv.push({ fr: r, fc: c, tr, tc, ...f }) };
    if (type === 'P') {
        const dir = col === 'w' ? -1 : 1, sr = col === 'w' ? 6 : 1;
        if (ib(r + dir, c) && !b[r + dir][c]) { add(r + dir, c); if (r === sr && !b[r + dir * 2][c]) add(r + dir * 2, c, { dbl: 1 }) }
        for (const dc of [-1, 1]) { const tr = r + dir, tc = c + dc; if (ib(tr, tc)) { if (b[tr][tc] && pc(b[tr][tc]) !== col) add(tr, tc); if (epp && epp[0] === tr && epp[1] === tc) mv.push({ fr: r, fc: c, tr, tc, epc: 1 }) } }
        return mv;
    }
    if (type === 'N') { for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) add(r + dr, c + dc); return mv }
    if (type === 'K') {
        for (const [dr, dc] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) add(r + dr, c + dc);
        const br = col === 'w' ? 7 : 0;
        if (r === br && c === 4) {
            if (crc[col + 'K'] && !b[br][5] && !b[br][6] && !atk(b, br, 4, opp(col)) && !atk(b, br, 5, opp(col)) && !atk(b, br, 6, opp(col))) mv.push({ fr: r, fc: c, tr: br, tc: 6, cas: 'K' });
            if (crc[col + 'Q'] && !b[br][3] && !b[br][2] && !b[br][1] && !atk(b, br, 4, opp(col)) && !atk(b, br, 3, opp(col)) && !atk(b, br, 2, opp(col))) mv.push({ fr: r, fc: c, tr: br, tc: 2, cas: 'Q' });
        }
        return mv;
    }
    const dirs = { R: [[-1, 0], [1, 0], [0, -1], [0, 1]], B: [[-1, -1], [-1, 1], [1, -1], [1, 1]], Q: [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]] };
    for (const [dr, dc] of dirs[type]) { for (let i = 1; i < 8; i++) { const tr = r + dr * i, nc = c + dc * i; if (!ib(tr, nc)) break; if (b[tr][nc]) { if (pc(b[tr][nc]) !== col) add(tr, nc); break } add(tr, nc) } }
    return mv;
}

function applyM(b, m, crc) {
    const nb = cb(b), p = nb[m.fr][m.fc];
    nb[m.tr][m.tc] = p; nb[m.fr][m.fc] = null;
    if (m.epc) { const d = pc(p) === 'w' ? 1 : -1; nb[m.tr + d][m.tc] = null }
    if (m.cas) { const br = m.tr; m.cas === 'K' ? (nb[br][5] = nb[br][7], nb[br][7] = null) : (nb[br][3] = nb[br][0], nb[br][0] = null) }
    if (m.promo) nb[m.tr][m.tc] = pc(p) + m.promo;
    return nb;
}

const legal = (b, r, c, epp, crc) => { const col = pc(b[r][c]); return raw(b, r, c, epp, crc).filter(m => !chk(applyM(b, m, crc), col)) };
function allLegal(b, col, epp, crc) { const a = []; for (let r = 0; r < 8; r++)for (let c = 0; c < 8; c++)if (pc(b[r][c]) === col) a.push(...legal(b, r, c, epp, crc)); return a }

const F = 'abcdefgh', RK = '87654321';
const ta = (r, c) => F[c] + RK[r];
function algStr(m, b, ck, mt) {
    const p = b[m.fr][m.fc], type = pt(p);
    if (m.cas) return m.cas === 'K' ? 'O-O' : 'O-O-O';
    let s = type === 'P' ? '' : type;
    if (type === 'P' && (m.fc !== m.tc || m.epc)) s = F[m.fc];
    if (b[m.tr][m.tc] || m.epc) s += 'x';
    s += ta(m.tr, m.tc); if (m.promo) s += '=' + m.promo;
    return s + (mt ? '#' : ck ? '+' : '');
}

/* ================================================================
   MOVE ANIMATION — flying piece
================================================================ */
const fp = document.getElementById('flying-piece');
let animating = false;

function sqCenter(r, c) {
    // Returns the center of square (r,c) relative to #board's top-left
    const boardEl = document.getElementById('board');
    const sz = boardEl.getBoundingClientRect();
    const sqW = sz.width / 8, sqH = sz.height / 8;
    const [dr, dc] = flipped ? [7 - r, 7 - c] : [r, c];
    return { x: dc * sqW + sqW / 2, y: dr * sqH + sqH / 2 };
}

function pieceCenter(r, c) {
    // returns {x,y} top-left position to place flying piece so it's centered
    const boardEl = document.getElementById('board');
    const sz = boardEl.getBoundingClientRect();
    const sqW = sz.width / 8, sqH = sz.height / 8;
    const [dr, dc] = flipped ? [7 - r, 7 - c] : [r, c];
    const fsz = parseFloat(getComputedStyle(fp).fontSize) || 36;
    return { x: dc * sqW + (sqW - fsz) / 2, y: dr * sqH + (sqH - fsz) / 2 };
}

function animateMove(pieceGlyph, fr, fc, tr, tc, onDone) {
    animating = true;
    fp.textContent = pieceGlyph;
    fp.style.display = 'block';
    fp.style.transition = 'none';
    fp.classList.remove('animate', 'drag-scale');

    const from = pieceCenter(fr, fc);
    const to = pieceCenter(tr, tc);

    fp.style.left = from.x + 'px';
    fp.style.top = from.y + 'px';
    fp.style.transform = 'scale(1)';

    // Force reflow then start transition
    fp.getBoundingClientRect();
    fp.classList.add('animate');
    fp.style.left = to.x + 'px';
    fp.style.top = to.y + 'px';
    fp.style.transform = 'scale(1.08)';

    const dur = 240;
    setTimeout(() => {
        fp.style.display = 'none';
        fp.classList.remove('animate');
        animating = false;
        onDone();
    }, dur);
}

/* ================================================================
   EXECUTE MOVE (with animation)
================================================================ */
function doMove(m, promoType, skipAnim) {
    if (animating) return;
    const glyph = G[board[m.fr][m.fc]];

    function commit() {
        shist.push(cst());
        const sv = cb(board);
        const p = board[m.fr][m.fc]; const col = pc(p), type = pt(p);
        const cap = board[m.tr][m.tc];
        if (cap) col === 'w' ? capW.push(cap) : capB.push(cap);
        if (m.epc) { const d = col === 'w' ? 1 : -1; const ep2 = board[m.tr + d][m.tc]; col === 'w' ? capW.push(ep2) : capB.push(ep2); board[m.tr + d][m.tc] = null }
        board[m.tr][m.tc] = p; board[m.fr][m.fc] = null;
        if (m.cas) { const br = m.tr; m.cas === 'K' ? (board[br][5] = board[br][7], board[br][7] = null) : (board[br][3] = board[br][0], board[br][0] = null) }
        if (type === 'K') { cr[col + 'K'] = false; cr[col + 'Q'] = false }
        if (type === 'R') { const br = col === 'w' ? 7 : 0; if (m.fc === 7 && m.fr === br) cr[col + 'K'] = false; if (m.fc === 0 && m.fr === br) cr[col + 'Q'] = false }
        ep = (type === 'P' && Math.abs(m.tr - m.fr) === 2) ? [(m.fr + m.tr) / 2, m.fc] : null;
        if (type === 'P' && (m.tr === 0 || m.tr === 7)) {
            if (promoType) { board[m.tr][m.tc] = col + promoType }
            else { pending = { m, col }; lf = [m.fr, m.fc]; lt = [m.tr, m.tc]; renderB(); updUI(); showPromo(col, m); return }
        }
        lf = [m.fr, m.fc]; lt = [m.tr, m.tc];
        const nx = opp(col);
        const nxm = allLegal(board, nx, ep, cr);
        const ck = chk(board, nx), mt = nxm.length === 0 && ck, st2 = nxm.length === 0 && !ck;
        mhist.push({ col, a: algStr(m, sv, ck && !mt, mt) });
        turn = nx;
        if (mt) { over = true; showGO('Checkmate', (col === 'w' ? 'White' : 'Black') + ' wins the match') }
        else if (st2) { over = true; showGO('Stalemate', 'The game is drawn') }
        renderB(); updUI();
        if (!over && gameMode === 'ai' && turn === 'b') schedAI();
    }

    if (skipAnim) { commit(); return }
    // Show transition — hide static piece on source, animate flying piece, then commit
    // Temporarily mark src so piece is hidden
    const srcEl = getSqEl(m.fr, m.fc);
    if (srcEl) srcEl.classList.add('dragging-src');
    animateMove(glyph, m.fr, m.fc, m.tr, m.tc, () => {
        if (srcEl) srcEl.classList.remove('dragging-src');
        commit();
    });
}

function getSqEl(r, c) {
    const [dr, dc] = flipped ? [7 - r, 7 - c] : [r, c];
    return document.querySelectorAll('.sq')[dr * 8 + dc] || null;
}

function showPromo(col, m) {
    const opts = col === 'w' ? [['Q', '♕'], ['R', '♖'], ['B', '♗'], ['N', '♘']] :
        [['Q', '♛'], ['R', '♜'], ['B', '♝'], ['N', '♞']];
    const c = document.getElementById('promo-choices'); c.innerHTML = '';
    opts.forEach(([t, g]) => {
        const btn = document.createElement('button'); btn.className = 'promo-btn'; btn.textContent = g;
        btn.onclick = () => {
            document.getElementById('promo-overlay').classList.remove('open');
            const pm = pending; pending = null;
            board[pm.m.tr][pm.m.tc] = pm.col + t;
            const nx = opp(pm.col), nxm = allLegal(board, nx, ep, cr);
            const ck = chk(board, nx), mt = nxm.length === 0 && ck, st2 = nxm.length === 0 && !ck;
            mhist.push({ col: pm.col, a: algStr(pm.m, board, ck && !mt, mt) });
            turn = nx;
            if (mt) { over = true; showGO('Checkmate', (pm.col === 'w' ? 'White' : 'Black') + ' wins') }
            else if (st2) { over = true; showGO('Stalemate', 'The game is drawn') }
            renderB(); updUI();
            if (!over && gameMode === 'ai' && turn === 'b') schedAI();
        };
        c.appendChild(btn);
    });
    document.getElementById('promo-overlay').classList.add('open');
}

function showGO(t, s) {
    document.getElementById('go-title').textContent = t;
    document.getElementById('go-sub').textContent = s;
    document.getElementById('gameover').classList.add('show');
    
    // Intercept game over for statistics
    if (t === 'Checkmate') {
        if (s.indexOf('White wins') !== -1) {
            recordGameResult('win');
        } else if (s.indexOf('Black wins') !== -1) {
            recordGameResult('loss');
        }
    } else if (t === 'Stalemate') {
        recordGameResult('draw');
    }
}

/* ================================================================
   AI — MINIMAX + ALPHA-BETA
================================================================ */
const PV = { K: 20000, Q: 900, R: 500, B: 330, N: 320, P: 100 };
const PST = {
    P: [[0, 0, 0, 0, 0, 0, 0, 0], [50, 50, 50, 50, 50, 50, 50, 50], [10, 10, 20, 30, 30, 20, 10, 10], [5, 5, 10, 25, 25, 10, 5, 5], [0, 0, 0, 20, 20, 0, 0, 0], [5, -5, -10, 0, 0, -10, -5, 5], [5, 10, 10, -20, -20, 10, 10, 5], [0, 0, 0, 0, 0, 0, 0, 0]],
    N: [[-50, -40, -30, -30, -30, -30, -40, -50], [-40, -20, 0, 0, 0, 0, -20, -40], [-30, 0, 10, 15, 15, 10, 0, -30], [-30, 5, 15, 20, 20, 15, 5, -30], [-30, 0, 15, 20, 20, 15, 0, -30], [-30, 5, 10, 15, 15, 10, 5, -30], [-40, -20, 0, 5, 5, 0, -20, -40], [-50, -40, -30, -30, -30, -30, -40, -50]],
    B: [[-20, -10, -10, -10, -10, -10, -10, -20], [-10, 0, 0, 0, 0, 0, 0, -10], [-10, 0, 5, 10, 10, 5, 0, -10], [-10, 5, 5, 10, 10, 5, 5, -10], [-10, 0, 10, 10, 10, 10, 0, -10], [-10, 10, 10, 10, 10, 10, 10, -10], [-10, 5, 0, 0, 0, 0, 5, -10], [-20, -10, -10, -10, -10, -10, -10, -20]],
    R: [[0, 0, 0, 0, 0, 0, 0, 0], [5, 10, 10, 10, 10, 10, 10, 5], [-5, 0, 0, 0, 0, 0, 0, -5], [-5, 0, 0, 0, 0, 0, 0, -5], [-5, 0, 0, 0, 0, 0, 0, -5], [-5, 0, 0, 0, 0, 0, 0, -5], [-5, 0, 0, 0, 0, 0, 0, -5], [0, 0, 0, 5, 5, 0, 0, 0]],
    Q: [[-20, -10, -10, -5, -5, -10, -10, -20], [-10, 0, 0, 0, 0, 0, 0, -10], [-10, 0, 5, 5, 5, 5, 0, -10], [-5, 0, 5, 5, 5, 5, 0, -5], [0, 0, 5, 5, 5, 5, 0, -5], [-10, 5, 5, 5, 5, 5, 0, -10], [-10, 0, 5, 0, 0, 0, 0, -10], [-20, -10, -10, -5, -5, -10, -10, -20]],
    K: [[-30, -40, -40, -50, -50, -40, -40, -30], [-30, -40, -40, -50, -50, -40, -40, -30], [-30, -40, -40, -50, -50, -40, -40, -30], [-30, -40, -40, -50, -50, -40, -40, -30], [-20, -30, -30, -40, -40, -30, -30, -20], [-10, -20, -20, -20, -20, -20, -20, -10], [20, 20, 0, 0, 0, 0, 20, 20], [20, 30, 10, 0, 0, 10, 30, 20]]
};
function evalB(b) { let s = 0; for (let r = 0; r < 8; r++)for (let c = 0; c < 8; c++) { const p = b[r][c]; if (!p) continue; const t = pt(p), col = pc(p), v = (PV[t] || 0) + (PST[t] ? PST[t][col === 'w' ? r : 7 - r][c] : 0); s += col === 'w' ? v : -v } return s }
function orderM(b, mvs) { return mvs.slice().sort((a, b2) => (b[b2.tr][b2.tc] ? PV[pt(b[b2.tr][b2.tc])] || 0 : 0) - (b[a.tr][a.tc] ? PV[pt(b[a.tr][a.tc])] || 0 : 0)) }

function mm(b, depth, alpha, beta, maxP, epp, crc) {
    const col = maxP ? 'w' : 'b', mvs = allLegal(b, col, epp, crc);
    if (depth === 0 || mvs.length === 0) { if (!mvs.length) return maxP ? (chk(b, col) ? -20000 : 0) : (chk(b, col) ? 20000 : 0); return evalB(b) }
    if (maxP) { let best = -Infinity; for (const m of orderM(b, mvs)) { const nb = applyM(b, m, crc); const nepp = (pt(b[m.fr][m.fc]) === 'P' && Math.abs(m.tr - m.fr) === 2) ? [(m.fr + m.tr) / 2, m.fc] : null; const ncr = { ...crc }; if (pt(b[m.fr][m.fc]) === 'K') { ncr[col + 'K'] = false; ncr[col + 'Q'] = false } best = Math.max(best, mm(nb, depth - 1, alpha, beta, false, nepp, ncr)); alpha = Math.max(alpha, best); if (beta <= alpha) break } return best }
    else { let best = Infinity; for (const m of orderM(b, mvs)) { const nb = applyM(b, m, crc); const nepp = (pt(b[m.fr][m.fc]) === 'P' && Math.abs(m.tr - m.fr) === 2) ? [(m.fr + m.tr) / 2, m.fc] : null; const ncr = { ...crc }; if (pt(b[m.fr][m.fc]) === 'K') { ncr[col + 'K'] = false; ncr[col + 'Q'] = false } best = Math.min(best, mm(nb, depth - 1, alpha, beta, true, nepp, ncr)); beta = Math.min(beta, best); if (beta <= alpha) break } return best }
}

function bestMove() {
    const mvs = allLegal(board, 'b', ep, cr); if (!mvs.length) return null;
    if (diff === 1) { const sc = mvs.map(m => ({ m, v: evalB(applyM(board, m, cr)) + (Math.random() * 250 - 125) })); sc.sort((a, b) => a.v - b.v); return sc[0].m }
    const depth = diff === 2 ? 2 : 3; let best = Infinity, bm = null;
    for (const m of orderM(board, mvs)) { const nb = applyM(board, m, cr); const nepp = (pt(board[m.fr][m.fc]) === 'P' && Math.abs(m.tr - m.fr) === 2) ? [(m.fr + m.tr) / 2, m.fc] : null; const ncr = { ...cr }; const v = mm(nb, depth - 1, -Infinity, Infinity, true, nepp, ncr) + (diff === 2 ? Math.random() * 25 - 12 : 0); if (v < best) { best = v; bm = m } }
    return bm;
}

function schedAI() {
    if (aiWorking) return;
    aiWorking = true;
    document.getElementById('ai-thinking').classList.add('show');
    document.getElementById('board-shell').classList.add('glow');
    setTimeout(() => {
        const m = bestMove();
        document.getElementById('ai-thinking').classList.remove('show');
        document.getElementById('board-shell').classList.remove('glow');
        aiWorking = false;
        if (m && !over) doMove(m, null, false);
    }, diff === 3 ? 750 : 350);
}

/* ================================================================
   RENDER
================================================================ */
const d2s = (dr, dc) => flipped ? [7 - dr, 7 - dc] : [dr, dc];

function renderB() {
    const el = document.getElementById('board');
    // Remove all sq elements, keep flying-piece
    [...el.querySelectorAll('.sq')].forEach(s => s.remove());
    const ki = chk(board, turn) ? findK(board, turn) : null;
    for (let dr = 0; dr < 8; dr++) {
        for (let dc = 0; dc < 8; dc++) {
            const [r, c] = d2s(dr, dc);
            const sq = document.createElement('div');
            sq.className = 'sq ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
            sq.dataset.r = r; sq.dataset.c = c;
            if (sel && sel[0] === r && sel[1] === c) sq.classList.add('selected');
            if (lf && lf[0] === r && lf[1] === c) sq.classList.add('lm-from');
            if (lt && lt[0] === r && lt[1] === c) sq.classList.add('lm-to');
            if (ki && ki[0] === r && ki[1] === c) sq.classList.add('in-check');
            if (sel && lvs.length) { const mv = lvs.find(m => m.tr === r && m.tc === c); if (mv) sq.classList.add(board[r][c] ? 'can-cap' : 'can-move') }
            if (board[r][c]) {
                const piece = document.createElement('div');
                piece.className = 'piece';
                piece.textContent = G[board[r][c]];
                sq.appendChild(piece);
            }
            el.appendChild(sq);
        }
    }
    attachEvents();
}

/* ================================================================
   INPUT — CLICK + DRAG/HOLD
================================================================ */
let dragState = null; // {r,c,glyph,moved}

function attachEvents() {
    const el = document.getElementById('board');
    el.onmousedown = onPointerDown;
    el.ontouchstart = onTouchStart;
    el.onmouseup = onPointerUp;
    el.ontouchend = onTouchEnd;
    el.onmousemove = onPointerMove;
    el.ontouchmove = onTouchMove;
    el.onclick = onBoardClick;
    // prevent context menu during drag
    el.oncontextmenu = e => dragState && e.preventDefault();
}

function sqFromEvent(e) {
    const boardEl = document.getElementById('board');
    const rect = boardEl.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left, y = clientY - rect.top;
    const sqW = rect.width / 8, sqH = rect.height / 8;
    const dc = Math.floor(x / sqW), dr = Math.floor(y / sqH);
    if (dc < 0 || dc > 7 || dr < 0 || dr > 7) return null;
    return d2s(dr, dc);
}

function canInteract() { return !over && !pending && !aiWorking && !animating }

// ── DRAG ──
function onPointerDown(e) {
    if (!canInteract()) return;
    if (e.button !== undefined && e.button !== 0) return;
    const sq = sqFromEvent(e);
    if (!sq) return;
    const [r, c] = sq;
    const p = board[r][c];
    if (!p || pc(p) !== turn) return;
    if (gameMode === 'ai' && turn === 'b') return;
    dragState = { r, c, glyph: G[p], startX: e.clientX || e.touches?.[0]?.clientX, startY: e.clientY || e.touches?.[0]?.clientY, moved: false, dragging: false };
}

function onTouchStart(e) {
    if (!canInteract()) return;
    const sq = sqFromEvent(e);
    if (!sq) return;
    const [r, c] = sq;
    const p = board[r][c];
    if (!p || pc(p) !== turn) return;
    if (gameMode === 'ai' && turn === 'b') return;
    const t = e.touches[0];
    dragState = { r, c, glyph: G[p], startX: t.clientX, startY: t.clientY, moved: false, dragging: false };
}

function startDrag(clientX, clientY) {
    if (!dragState) return;
    dragState.dragging = true;
    // Select piece and compute legal moves
    const { r, c } = dragState;
    sel = [r, c];
    lvs = legal(board, r, c, ep, cr);
    // Show flying piece at cursor
    fp.textContent = dragState.glyph;
    fp.style.transition = 'none';
    fp.classList.remove('animate');
    fp.style.display = 'block';
    fp.classList.add('drag-scale');
    positionFlyingAtCursor(clientX, clientY);
    // Hide static piece on src sq
    const srcEl = getSqEl(r, c);
    if (srcEl) srcEl.classList.add('dragging-src');
    renderB();
}

function positionFlyingAtCursor(clientX, clientY) {
    const boardEl = document.getElementById('board');
    const rect = boardEl.getBoundingClientRect();
    const fsz = parseFloat(getComputedStyle(fp).fontSize) || 36;
    fp.style.left = (clientX - rect.left - fsz * 0.6) + 'px';
    fp.style.top = (clientY - rect.top - fsz * 0.7) + 'px';
}

function onPointerMove(e) {
    if (!dragState) return;
    const clientX = e.clientX, clientY = e.clientY;
    if (!dragState.dragging) {
        const dx = Math.abs(clientX - dragState.startX), dy = Math.abs(clientY - dragState.startY);
        if (dx > 4 || dy > 4) startDrag(clientX, clientY);
        return;
    }
    positionFlyingAtCursor(clientX, clientY);
}

function onTouchMove(e) {
    if (!dragState) return;
    e.preventDefault();
    const t = e.touches[0];
    if (!dragState.dragging) {
        const dx = Math.abs(t.clientX - dragState.startX), dy = Math.abs(t.clientY - dragState.startY);
        if (dx > 6 || dy > 6) startDrag(t.clientX, t.clientY);
        return;
    }
    positionFlyingAtCursor(t.clientX, t.clientY);
}

function onPointerUp(e) {
    if (!dragState) return;
    const ds = dragState; dragState = null;
    if (!ds.dragging) { return } // will be handled by click
    fp.style.display = 'none'; fp.classList.remove('drag-scale');
    const srcEl = getSqEl(ds.r, ds.c); if (srcEl) srcEl.classList.remove('dragging-src');
    const sq = sqFromEvent(e);
    if (!sq) { sel = null; lvs = []; renderB(); return }
    const [tr, tc] = sq;
    const mv = lvs.find(m => m.tr === tr && m.tc === tc);
    if (mv) {
        sel = null; lvs = [];
        // Animate landing from cursor to center of target sq
        const boardEl = document.getElementById('board');
        const rect = boardEl.getBoundingClientRect();
        const fsz = parseFloat(getComputedStyle(fp).fontSize) || 36;
        const curX = parseFloat(fp.style.left);
        const curY = parseFloat(fp.style.top);
        const to = pieceCenter(tr, tc);
        fp.style.display = 'block'; fp.textContent = ds.glyph;
        fp.classList.remove('animate', 'drag-scale');
        fp.style.left = curX + 'px'; fp.style.top = curY + 'px'; fp.style.transform = 'scale(1.15)';
        fp.getBoundingClientRect();
        fp.classList.add('animate');
        fp.style.left = to.x + 'px'; fp.style.top = to.y + 'px'; fp.style.transform = 'scale(1)';
        animating = true;
        setTimeout(() => { fp.style.display = 'none'; fp.classList.remove('animate'); animating = false; doMove(mv, null, true); }, 200);
    } else {
        sel = null; lvs = []; renderB();
    }
}

function onTouchEnd(e) {
    if (!dragState) return;
    const ds = dragState; dragState = null;
    if (!ds.dragging) {
        // treat as click
        const sq = sqFromEvent({ clientX: ds.startX, clientY: ds.startY });
        if (sq) handleClick(sq[0], sq[1]);
        return;
    }
    fp.style.display = 'none'; fp.classList.remove('drag-scale');
    const srcEl = getSqEl(ds.r, ds.c); if (srcEl) srcEl.classList.remove('dragging-src');
    const fakeEv = { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY };
    const sq = sqFromEvent(fakeEv);
    if (!sq) { sel = null; lvs = []; renderB(); return }
    const [tr, tc] = sq;
    const mv = lvs.find(m => m.tr === tr && m.tc === tc);
    if (mv) { sel = null; lvs = []; doMove(mv, null, false) }
    else { sel = null; lvs = []; renderB() }
}

// ── CLICK ──
function onBoardClick(e) {
    if (!canInteract()) return;
    if (dragState) return; // drag in progress
    const sq = sqFromEvent(e);
    if (!sq) return;
    handleClick(sq[0], sq[1]);
}

function handleClick(r, c) {
    if (!canInteract()) return;
    if (gameMode === 'ai' && turn === 'b') return;
    const p = board[r][c];
    if (sel) {
        const mv = lvs.find(m => m.tr === r && m.tc === c);
        if (mv) { sel = null; lvs = []; doMove(mv, null, false); return }
        if (p && pc(p) === turn) { sel = [r, c]; lvs = legal(board, r, c, ep, cr); renderB(); return }
        sel = null; lvs = [];
    } else {
        if (p && pc(p) === turn) { sel = [r, c]; lvs = legal(board, r, c, ep, cr) }
    }
    renderB();
}

function renderLabels() {
    const rc = document.getElementById('rank-col'), fr = document.getElementById('file-row');
    rc.innerHTML = ''; fr.innerHTML = '';
    const rs = flipped ? '12345678' : '87654321', fs = flipped ? 'hgfedcba' : 'abcdefgh';
    for (const l of rs) { const s = document.createElement('div'); s.className = 'coord'; s.textContent = l; rc.appendChild(s) }
    for (const l of fs) { const s = document.createElement('div'); s.className = 'coord'; s.textContent = l; fr.appendChild(s) }
}

function updUI() {
    document.getElementById('white-card').classList.toggle('active-turn', turn === 'w' && !over);
    document.getElementById('black-card').classList.toggle('active-turn', turn === 'b' && !over);
    const sm = document.getElementById('status-main'), ss = document.getElementById('status-sub');
    if (over) { sm.textContent = 'Game over'; sm.className = 'status-main'; ss.textContent = 'Press New Game' }
    else { sm.textContent = (turn === 'w' ? 'White' : 'Black') + ' to move'; sm.className = 'status-main' + (chk(board, turn) ? ' check' : ''); const ph = mhist.length < 8 ? 'Opening' : mhist.length < 25 ? 'Middlegame' : 'Endgame'; ss.textContent = chk(board, turn) ? '⚠ King in check' : ph }
    document.getElementById('cap-white').innerHTML = capW.map(p => '<span>' + G[p] + '</span>').join('');
    document.getElementById('cap-black').innerHTML = capB.map(p => '<span>' + G[p] + '</span>').join('');
    const hl = document.getElementById('hist-list');
    const pairs = []; let i = 0;
    while (i < mhist.length) { const pr = { n: Math.floor(i / 2) + 1, w: '', b: '' }; if (mhist[i]?.col === 'w') pr.w = mhist[i].a; else if (mhist[i]) pr.b = mhist[i].a; i++; if (i < mhist.length && mhist[i].col === 'b') { pr.b = mhist[i].a; i++ } pairs.push(pr) }
    hl.innerHTML = pairs.map(p => `<div class="hist-row"><span class="hist-n">${p.n}.</span><span>${p.w}</span><span>${p.b}</span></div>`).join('');
    hl.scrollTop = hl.scrollHeight;
}

/* ================================================================
   CONTROLS
================================================================ */
function newGame() { document.getElementById('gameover').classList.remove('show'); fp.style.display = 'none'; animating = false; init(); updateModeUI(); renderB(); renderLabels(); updUI() }
function undoMove() { if (!shist.length || aiWorking || animating) return; let s = gameMode === 'ai' ? 2 : 1; while (s-- > 0 && shist.length) rst(shist.pop()); sel = null; lvs = []; over = false; document.getElementById('gameover').classList.remove('show'); renderB(); updUI() }
function flipBoard() { flipped = !flipped; sel = null; lvs = []; renderB(); renderLabels() }
function setMode(m) { gameMode = m; document.getElementById('mode-human').classList.toggle('active', m === 'human'); document.getElementById('mode-ai').classList.toggle('active', m === 'ai'); updateModeUI(); newGame() }
function setDiff(d) { diff = d; document.querySelectorAll('.diff-btn').forEach(b => b.classList.toggle('active', +b.dataset.d === d)) }
function updateModeUI() {
    const isAI = gameMode === 'ai';
    document.getElementById('diff-row').style.display = isAI ? 'flex' : 'none';
    document.getElementById('black-name').textContent = isAI ? 'Final Check AI' : 'Player 2';
    const lbl = document.getElementById('black-sub'); lbl.textContent = isAI ? 'Minimax engine' : 'Black pieces'; lbl.className = 'p-label' + (isAI ? ' ai' : '');
    document.getElementById('black-avatar').textContent = isAI ? '🤖' : '♛';
}

/* ================================================================
   SPA NAVIGATION & AUTHENTICATION
================================================================ */

function navigateTo(viewName) {
    document.getElementById('home-view').style.display = 'none';
    document.getElementById('game-view').style.display = 'none';
    
    document.getElementById('link-home').classList.remove('active');
    document.getElementById('link-play-ai').classList.remove('active');
    document.getElementById('link-play-local').classList.remove('active');
    
    if (viewName === 'home') {
        document.getElementById('home-view').style.display = 'block';
        document.getElementById('link-home').classList.add('active');
        updateStatsDisplay();
    } else if (viewName === 'game') {
        document.getElementById('game-view').style.display = 'block';
        if (gameMode === 'ai') {
            document.getElementById('link-play-ai').classList.add('active');
        } else {
            document.getElementById('link-play-local').classList.add('active');
        }
    }
    window.scrollTo(0, 0);
}

function scrollToRules() {
    navigateTo('home');
    setTimeout(() => {
        const rulesEl = document.getElementById('rules-section');
        if (rulesEl) {
            rulesEl.scrollIntoView({ behavior: 'smooth' });
        }
    }, 100);
}

function startNewGame(mode) {
    setMode(mode);
    navigateTo('game');
}

function handleLogout() {
    localStorage.removeItem('currentUser');
    updateUserInterface();
    updateStatsDisplay();
    navigateTo('home');
}

function updateUserInterface() {
    const activeUser = localStorage.getItem('currentUser');
    const authSection = document.getElementById('nav-auth-section');
    
    if (activeUser) {
        authSection.innerHTML = `
            <div class="nav-profile-wrapper">
                <span class="nav-username">👤 ${activeUser}</span>
                <button class="nav-logout" onclick="handleLogout()">Sign Out</button>
            </div>
        `;
    } else {
        authSection.innerHTML = `
            <button class="nav-btn" onclick="window.location.href='./Login-signup/signin.html'">Sign In</button>
        `;
    }
}

function updateStatsDisplay() {
    const activeUser = localStorage.getItem('currentUser');
    let stats = { played: 0, wins: 0, losses: 0, draws: 0 };
    let displayName = "Guest";
    
    if (activeUser) {
        const users = JSON.parse(localStorage.getItem('users') || '{}');
        if (users[activeUser] && users[activeUser].stats) {
            stats = users[activeUser].stats;
        }
        displayName = activeUser;
        document.getElementById('stats-auth-prompt').style.display = 'none';
        document.getElementById('leader-user-name').textContent = `${activeUser} (You)`;
    } else {
        const guestStats = JSON.parse(localStorage.getItem('guestStats') || '{"played": 0, "wins": 0, "losses": 0, "draws": 0}');
        stats = guestStats;
        displayName = "Guest";
        document.getElementById('stats-auth-prompt').style.display = 'flex';
        document.getElementById('leader-user-name').textContent = "You (Guest)";
    }
    
    document.getElementById('stats-username').textContent = displayName;
    document.getElementById('stat-played').textContent = stats.played;
    document.getElementById('stat-wins').textContent = stats.wins;
    document.getElementById('stat-losses').textContent = stats.losses;
    document.getElementById('stat-draws').textContent = stats.draws;
    
    document.getElementById('leader-user-record').textContent = `${stats.wins} / ${stats.losses} / ${stats.draws}`;
    
    // Set custom names for Player 1 / Player 2 based on active username
    const isAI = gameMode === 'ai';
    document.getElementById('white-name').textContent = activeUser ? activeUser : 'Player 1';
    if (!isAI) {
        document.getElementById('black-name').textContent = 'Player 2';
    }
}

function recordGameResult(result) {
    const activeUser = localStorage.getItem('currentUser');
    if (activeUser) {
        const users = JSON.parse(localStorage.getItem('users') || '{}');
        if (users[activeUser]) {
            if (!users[activeUser].stats) {
                users[activeUser].stats = { played: 0, wins: 0, losses: 0, draws: 0 };
            }
            users[activeUser].stats.played += 1;
            if (result === 'win') users[activeUser].stats.wins += 1;
            else if (result === 'loss') users[activeUser].stats.losses += 1;
            else if (result === 'draw') users[activeUser].stats.draws += 1;
            
            localStorage.setItem('users', JSON.stringify(users));
        }
    } else {
        const guestStats = JSON.parse(localStorage.getItem('guestStats') || '{"played": 0, "wins": 0, "losses": 0, "draws": 0}');
        guestStats.played += 1;
        if (result === 'win') guestStats.wins += 1;
        else if (result === 'loss') guestStats.losses += 1;
        else if (result === 'draw') guestStats.draws += 1;
        localStorage.setItem('guestStats', JSON.stringify(guestStats));
    }
    
    updateStatsDisplay();
}

/* ================================================================
   INIT
================================================================ */
init();
renderB();
renderLabels();
updUI();
updateUserInterface();
updateStatsDisplay();