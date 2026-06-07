/* ================================================================
   CHESS ENGINE
================================================================ */
const G = { 
    wK: '♚', wQ: '♛', wR: '♜', wB: '♝', wN: '♞', wP: '♟', 
    bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟' 
};
let board, turn, sel, lvs = [], capW = [], capB = [], mhist = [], shist = [];
let lf = null, lt = null, flipped = false, over = false, ep = null;
let cr = { wK: true, wQ: true, bK: true, bQ: true };
let pending = null, gameMode = 'human', diff = 2, aiWorking = false;
let activeChallengeId = null, myPlayerColor = null, opponentUsername = null;
let activeSocialTab = 'friends', challengeUnsubscribe = null, socialUnsubscribe = null, challengesUnsubscribe = null;

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
    pending = null; aiWorking = false; dragState = null; activeChallengeId = null;
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
    
    const pieceCode = board[fr][fc];
    const isWhite = pieceCode && pieceCode[0] === 'w';
    fp.className = 'piece ' + (isWhite ? 'white-piece' : 'black-piece');
    
    fp.style.display = 'block';
    fp.style.transition = 'none';
    fp.classList.remove('animate', 'drag-scale');

    const from = pieceCenter(fr, fc);
    const to = pieceCenter(tr, tc);

    fp.style.transform = `translate3d(${from.x}px, ${from.y}px, 0) scale(1)`;

    // Force reflow then start transition
    fp.getBoundingClientRect();
    fp.classList.add('animate');
    fp.style.transform = `translate3d(${to.x}px, ${to.y}px, 0) scale(1.08)`;

    const dur = 260;
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
        syncChallengeState();
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
    const opts = [['Q', '♛'], ['R', '♜'], ['B', '♝'], ['N', '♞']];
    const c = document.getElementById('promo-choices'); c.innerHTML = '';
    opts.forEach(([t, g]) => {
        const btn = document.createElement('button'); 
        btn.className = 'promo-btn ' + (col === 'w' ? 'white-piece' : 'black-piece'); 
        btn.textContent = g;
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
            syncChallengeState();
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
                const pColor = board[r][c][0];
                piece.className = 'piece ' + (pColor === 'w' ? 'white-piece' : 'black-piece');
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

function canInteract() { 
    if (over || pending || aiWorking || animating) return false;
    if (activeChallengeId && turn !== myPlayerColor) return false;
    return true;
}

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
    
    const pieceCode = board[r][c];
    const isWhite = pieceCode && pieceCode[0] === 'w';
    fp.className = 'piece ' + (isWhite ? 'white-piece' : 'black-piece');
    
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
    const x = clientX - rect.left - fsz * 0.6;
    const y = clientY - rect.top - fsz * 0.7;
    fp.style.transform = `translate3d(${x}px, ${y}px, 0) scale(1.22)`;
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

function handleRelease(ds, sq) {
    // Measure current position before modifying display/styles
    const boardEl = document.getElementById('board');
    const rect = boardEl.getBoundingClientRect();
    const fpRect = fp.getBoundingClientRect();
    const curX = fpRect.left - rect.left;
    const curY = fpRect.top - rect.top;

    fp.style.display = 'none'; 
    fp.classList.remove('drag-scale');
    const srcEl = getSqEl(ds.r, ds.c); 
    if (srcEl) srcEl.classList.remove('dragging-src');
    
    if (!sq) { 
        sel = null; 
        lvs = []; 
        renderB(); 
        return; 
    }
    const [tr, tc] = sq;
    const mv = lvs.find(m => m.tr === tr && m.tc === tc);
    if (mv) {
        sel = null; 
        lvs = [];
        const to = pieceCenter(tr, tc);
        fp.style.display = 'block'; 
        fp.textContent = ds.glyph;
        
        const pCode = board[ds.r][ds.c];
        const isWhite = pCode && pCode[0] === 'w';
        fp.className = 'piece ' + (isWhite ? 'white-piece' : 'black-piece');
        
        fp.classList.remove('animate', 'drag-scale');
        fp.style.transform = `translate3d(${curX}px, ${curY}px, 0) scale(1.15)`;
        fp.getBoundingClientRect(); // force reflow
        
        fp.classList.add('animate');
        fp.style.transform = `translate3d(${to.x}px, ${to.y}px, 0) scale(1)`;
        animating = true;
        
        setTimeout(() => { 
            fp.style.display = 'none'; 
            fp.classList.remove('animate'); 
            animating = false; 
            doMove(mv, null, true); 
        }, 200);
    } else {
        sel = null; 
        lvs = []; 
        renderB();
    }
}

function onPointerUp(e) {
    if (!dragState) return;
    const ds = dragState; dragState = null;
    if (!ds.dragging) { return } // will be handled by click
    const sq = sqFromEvent(e);
    handleRelease(ds, sq);
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
    const t = e.changedTouches[0];
    const sq = sqFromEvent({ clientX: t.clientX, clientY: t.clientY });
    handleRelease(ds, sq);
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
    document.getElementById('cap-white').innerHTML = capW.map(p => `<span class="black-piece">${G[p]}</span>`).join('');
    document.getElementById('cap-black').innerHTML = capB.map(p => `<span class="white-piece">${G[p]}</span>`).join('');
    const hl = document.getElementById('hist-list');
    const pairs = []; let i = 0;
    while (i < mhist.length) { const pr = { n: Math.floor(i / 2) + 1, w: '', b: '' }; if (mhist[i]?.col === 'w') pr.w = mhist[i].a; else if (mhist[i]) pr.b = mhist[i].a; i++; if (i < mhist.length && mhist[i].col === 'b') { pr.b = mhist[i].a; i++ } pairs.push(pr) }
    hl.innerHTML = pairs.map(p => `<div class="hist-row"><span class="hist-n">${p.n}.</span><span>${p.w}</span><span>${p.b}</span></div>`).join('');
    hl.scrollTop = hl.scrollHeight;
}

/* ================================================================
   CONTROLS
================================================================ */
function newGame() { 
    if (activeChallengeId) {
        if (!confirm("This will disconnect you from the active online game. Are you sure?")) {
            return;
        }
        if (challengeUnsubscribe) {
            challengeUnsubscribe();
            challengeUnsubscribe = null;
        }
        activeChallengeId = null;
        document.getElementById('btn-resign-game').style.display = 'none';
    }
    document.getElementById('gameover').classList.remove('show'); fp.style.display = 'none'; animating = false; init(); updateModeUI(); renderB(); renderLabels(); updUI();
}
function undoMove() { 
    if (activeChallengeId) {
        alert("Undo is disabled in online multiplayer matches.");
        return;
    }
    if (!shist.length || aiWorking || animating) return; 
    let s = gameMode === 'ai' ? 2 : 1; 
    while (s-- > 0 && shist.length) rst(shist.pop()); 
    sel = null; 
    lvs = []; 
    over = false; 
    document.getElementById('gameover').classList.remove('show'); 
    renderB(); 
    updUI(); 
}
function flipBoard() { flipped = !flipped; sel = null; lvs = []; renderB(); renderLabels() }
function setMode(m) { gameMode = m; document.getElementById('mode-human').classList.toggle('active', m === 'human'); document.getElementById('mode-ai').classList.toggle('active', m === 'ai'); updateModeUI(); newGame() }
function setDiff(d) { diff = d; document.querySelectorAll('.diff-btn').forEach(b => b.classList.toggle('active', +b.dataset.d === d)) }

/* ================================================================
   THEME SWITCHING SYSTEM
================================================================ */
const themes = ['space', 'light', 'midnight'];
const themeIcons = {
    space: '🌌',
    light: '☀️',
    midnight: '🌑'
};

function cycleTheme() {
    const currentTheme = localStorage.getItem('theme') || 'space';
    const nextIndex = (themes.indexOf(currentTheme) + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    setTheme(nextTheme);
}

function setTheme(themeName) {
    localStorage.setItem('theme', themeName);
    document.documentElement.setAttribute('data-theme', themeName);
    
    // Update button icon if button exists
    const btnIcon = document.querySelector('.theme-icon');
    if (btnIcon) {
        btnIcon.textContent = themeIcons[themeName];
    }
}

// Sync UI theme icon on script load
(function initThemeUI() {
    const savedTheme = localStorage.getItem('theme') || 'space';
    setTheme(savedTheme);
})();
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
        
        // Disconnect from active online challenge if returning to home
        if (activeChallengeId) {
            if (challengeUnsubscribe) {
                challengeUnsubscribe();
                challengeUnsubscribe = null;
            }
            activeChallengeId = null;
            document.getElementById('btn-resign-game').style.display = 'none';
        }
        
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
        const socialCard = document.getElementById('social-card');
        if (socialCard) socialCard.style.display = 'block';
        
        startSocialHubListener();
        startChallengesListener();
    } else {
        authSection.innerHTML = `
            <button class="nav-btn" onclick="window.location.href='./Login-signup/signin.html'">Sign In</button>
        `;
        const socialCard = document.getElementById('social-card');
        if (socialCard) socialCard.style.display = 'none';
        
        if (socialUnsubscribe) {
            socialUnsubscribe();
            socialUnsubscribe = null;
        }
        if (challengesUnsubscribe) {
            challengesUnsubscribe();
            challengesUnsubscribe = null;
        }
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
        
        // Fetch latest stats from Firestore asynchronously
        if (window.firebaseReady && window.db) {
            db.collection('users').doc(activeUser).get().then(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    if (userData.stats) {
                        // Update cache
                        const usersCache = JSON.parse(localStorage.getItem('users') || '{}');
                        if (usersCache[activeUser]) {
                            usersCache[activeUser].stats = userData.stats;
                            localStorage.setItem('users', JSON.stringify(usersCache));
                        }
                        // Update UI stats elements
                        document.getElementById('stat-played').textContent = userData.stats.played;
                        document.getElementById('stat-wins').textContent = userData.stats.wins;
                        document.getElementById('stat-losses').textContent = userData.stats.losses;
                        document.getElementById('stat-draws').textContent = userData.stats.draws;
                    }
                }
            }).catch(err => console.error("Error fetching stats from Firestore:", err));
        }
    } else {
        const guestStats = JSON.parse(localStorage.getItem('guestStats') || '{"played": 0, "wins": 0, "losses": 0, "draws": 0}');
        stats = guestStats;
        displayName = "Guest";
        document.getElementById('stats-auth-prompt').style.display = 'flex';
    }
    
    document.getElementById('stats-username').textContent = displayName;
    document.getElementById('stat-played').textContent = stats.played;
    document.getElementById('stat-wins').textContent = stats.wins;
    document.getElementById('stat-losses').textContent = stats.losses;
    document.getElementById('stat-draws').textContent = stats.draws;
    
    // Update dynamic leaderboard
    updateLeaderboardDisplay(activeUser);
    
    // Set custom names for Player 1 / Player 2 based on active username
    const isAI = gameMode === 'ai';
    document.getElementById('white-name').textContent = activeUser ? activeUser : 'Player 1';
    if (!isAI) {
        document.getElementById('black-name').textContent = 'Player 2';
    }
}

function updateLeaderboardDisplay(activeUser) {
    const leaderboardList = document.getElementById('leaderboard-list');
    if (!leaderboardList) return;

    // 1. Initial render from local cache
    const localUsers = JSON.parse(localStorage.getItem('users') || '{}');
    renderLeaderboardRows(Object.values(localUsers), activeUser);

    // 2. Async render from Firestore
    if (window.firebaseReady && window.db) {
        db.collection('users').get().then(querySnapshot => {
            const firestoreUsers = [];
            querySnapshot.forEach(doc => {
                firestoreUsers.push(doc.data());
            });
            
            // Sync local storage cache
            const cachedUsers = {};
            firestoreUsers.forEach(u => {
                cachedUsers[u.username] = u;
            });
            localStorage.setItem('users', JSON.stringify(cachedUsers));

            // Re-render rows
            renderLeaderboardRows(firestoreUsers, activeUser);
        }).catch(err => console.error("Error reading leaderboard from Firestore:", err));
    }
}

function renderLeaderboardRows(usersList, activeUser) {
    const leaderboardList = document.getElementById('leaderboard-list');
    if (!leaderboardList) return;

    const sortedUsers = usersList.filter(u => u.stats && u.stats.played > 0);
    
    sortedUsers.sort((a, b) => {
        if (b.stats.wins !== a.stats.wins) {
            return b.stats.wins - a.stats.wins;
        }
        if (b.stats.draws !== a.stats.draws) {
            return b.stats.draws - a.stats.draws;
        }
        return a.stats.played - b.stats.played;
    });

    let html = `
        <div class="leader-row header-row">
            <span>Rank</span>
            <span>Player</span>
            <span>Record (W/L/D)</span>
        </div>
    `;

    if (sortedUsers.length === 0) {
        html += `
            <div style="text-align: center; padding: 20px 10px; color: var(--text-secondary); font-size: 0.82rem; border: 1px dashed var(--glass-border); border-radius: var(--radius-sm); margin-top: 4px;">
                No ranked players yet. Create an account and play to start the ranking!
            </div>
        `;
    } else {
        sortedUsers.forEach((user, idx) => {
            const rank = idx + 1;
            const isSelf = user.username === activeUser;
            html += `
                <div class="leader-row">
                    <span class="rank-badge${rank <= 3 ? ' rank-' + rank : ''}">${rank}</span>
                    <span class="player-name">${user.username}${isSelf ? ' (You)' : ''}</span>
                    <span class="player-record">${user.stats.wins} / ${user.stats.losses} / ${user.stats.draws}</span>
                </div>
            `;
        });
    }

    leaderboardList.innerHTML = html;
}

function recordGameResult(result) {
    const activeUser = localStorage.getItem('currentUser');
    if (activeUser) {
        // Optimistic local update
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

        // Firestore database transaction update
        if (window.firebaseReady && window.db) {
            const userRef = db.collection('users').doc(activeUser);
            db.runTransaction(async (transaction) => {
                const sfDoc = await transaction.get(userRef);
                if (!sfDoc.exists) {
                    const localUserData = JSON.parse(localStorage.getItem('users') || '{}')[activeUser];
                    if (localUserData) {
                        transaction.set(userRef, localUserData);
                    }
                    return;
                }
                const currentStats = sfDoc.data().stats || { played: 0, wins: 0, losses: 0, draws: 0 };
                const nextStats = {
                    played: currentStats.played + 1,
                    wins: currentStats.wins + (result === 'win' ? 1 : 0),
                    losses: currentStats.losses + (result === 'loss' ? 1 : 0),
                    draws: currentStats.draws + (result === 'draw' ? 1 : 0)
                };
                transaction.update(userRef, { stats: nextStats });
            }).then(() => {
                console.log("Stats transaction committed successfully to Firestore.");
                // Fetch stats again to make sure UI is up-to-date
                updateStatsDisplay();
            }).catch(err => {
                console.error("Firestore stats transaction failed:", err);
            });
        }
    } else {
        // Guest account: Keep exclusively in localStorage (won't be added to Firestore)
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
   MULTIPLAYER GAMEPLAY SYNC & SOCIAL SYSTEM
   ================================================================ */
function syncChallengeState() {
    if (!activeChallengeId || !window.firebaseReady || !window.db) return;
    
    const activeUser = localStorage.getItem('currentUser');
    const challengerUsername = myPlayerColor === 'w' ? activeUser : opponentUsername;
    const challengedUsername = myPlayerColor === 'b' ? activeUser : opponentUsername;
    
    let winner = null;
    if (over) {
        const statusMain = document.getElementById('status-main').textContent;
        const statusSub = document.getElementById('status-sub').textContent;
        if (statusSub.includes("drawn") || statusMain.includes("Stalemate")) {
            winner = 'draw';
        } else {
            winner = turn === 'w' ? challengedUsername : challengerUsername;
        }
    }
    
    db.collection('challenges').doc(activeChallengeId).update({
        board: board,
        turn: turn,
        mhist: mhist,
        lf: lf,
        lt: lt,
        ep: ep,
        cr: cr,
        over: over,
        winner: winner,
        status: over ? 'completed' : 'playing',
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(err => console.error("Error syncing challenge state:", err));
}

function listenToChallenge(challengeId) {
    if (challengeUnsubscribe) challengeUnsubscribe();
    
    const activeUser = localStorage.getItem('currentUser');
    
    challengeUnsubscribe = db.collection('challenges').doc(challengeId).onSnapshot(doc => {
        if (!doc.exists) return;
        const data = doc.data();
        
        if (data.status === 'playing') {
            if (data.challenger === activeUser) {
                myPlayerColor = data.challengerColor;
                opponentUsername = data.challenged;
            } else if (data.challenged === activeUser) {
                myPlayerColor = data.challengerColor === 'w' ? 'b' : 'w';
                opponentUsername = data.challenger;
            }
            
            document.getElementById('btn-resign-game').style.display = 'inline-block';
            
            const isAI = gameMode === 'ai';
            if (!isAI) {
                document.getElementById('white-name').textContent = myPlayerColor === 'w' ? activeUser : opponentUsername;
                document.getElementById('black-name').textContent = myPlayerColor === 'b' ? activeUser : opponentUsername;
            }
            
            if (JSON.stringify(board) !== JSON.stringify(data.board) || over !== data.over || turn !== data.turn) {
                board = data.board;
                turn = data.turn;
                mhist = data.mhist;
                lf = data.lf;
                lt = data.lt;
                ep = data.ep;
                cr = data.cr;
                over = data.over;
                
                renderB();
                updUI();
                
                if (over) {
                    const winner = data.winner;
                    if (winner === 'draw') {
                        showGO('Stalemate', 'The game is drawn');
                    } else {
                        showGO('Checkmate', winner + ' wins');
                    }
                    document.getElementById('btn-resign-game').style.display = 'none';
                }
            }
        } else if (data.status === 'completed') {
            if (JSON.stringify(board) !== JSON.stringify(data.board) || !over) {
                board = data.board;
                turn = data.turn;
                mhist = data.mhist;
                lf = data.lf;
                lt = data.lt;
                ep = data.ep;
                cr = data.cr;
                over = data.over;
                renderB();
                updUI();
            }
            
            if (!over) {
                over = true;
                const winner = data.winner;
                if (winner === 'draw') {
                    showGO('Stalemate', 'The game is drawn');
                } else {
                    showGO('Resignation', winner + ' wins by resignation');
                    if (winner === activeUser) {
                        recordGameResult('win');
                    }
                }
            }
            document.getElementById('btn-resign-game').style.display = 'none';
        }
    }, err => {
        console.error("Challenge listen error:", err);
    });
}

function resignChallenge() {
    if (!activeChallengeId || !window.firebaseReady || !window.db) return;
    if (confirm("Are you sure you want to resign the match?")) {
        const winner = opponentUsername;
        db.collection('challenges').doc(activeChallengeId).update({
            over: true,
            winner: winner,
            status: 'completed',
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            recordGameResult('loss');
        }).catch(err => console.error("Resignation failed:", err));
    }
}

function checkURLChallenge() {
    const params = new URLSearchParams(window.location.search);
    const challengeId = params.get('challengeId');
    if (!challengeId) return;
    
    const activeUser = localStorage.getItem('currentUser');
    if (!activeUser) {
        localStorage.setItem('pendingChallengeId', challengeId);
        alert("You have been invited to a chess match! Please Sign In or Create an Account to play.");
        window.location.href = './Login-signup/signin.html';
        return;
    }
    
    db.collection('challenges').doc(challengeId).get().then(async doc => {
        if (!doc.exists) {
            alert("Invite link is invalid or has expired.");
            return;
        }
        
        const data = doc.data();
        activeChallengeId = challengeId;
        
        if (data.status === 'pending') {
            if (data.challenger !== activeUser) {
                myPlayerColor = data.challengerColor === 'w' ? 'b' : 'w';
                opponentUsername = data.challenger;
                
                await db.collection('challenges').doc(challengeId).update({
                    challenged: activeUser,
                    status: 'playing',
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                myPlayerColor = data.challengerColor;
                opponentUsername = null;
                alert("Waiting for an opponent to join. Share the link with a friend!");
            }
        } else if (data.status === 'playing') {
            if (data.challenger === activeUser) {
                myPlayerColor = data.challengerColor;
                opponentUsername = data.challenged;
            } else if (data.challenged === activeUser) {
                myPlayerColor = data.challengerColor === 'w' ? 'b' : 'w';
                opponentUsername = data.challenger;
            } else {
                alert("This game is already in progress between two other players.");
                activeChallengeId = null;
                return;
            }
        } else if (data.status === 'completed') {
            alert("This game has already finished.");
            activeChallengeId = null;
            return;
        }
        
        gameMode = 'human';
        flipped = (myPlayerColor === 'b');
        
        board = data.board;
        turn = data.turn;
        mhist = data.mhist;
        lf = data.lf;
        lt = data.lt;
        ep = data.ep;
        cr = data.cr;
        over = data.over;
        
        navigateTo('game');
        newGameMultiplayer();
        listenToChallenge(challengeId);
    }).catch(err => {
        console.error("Error loading challenge:", err);
    });
}

function newGameMultiplayer() {
    document.getElementById('gameover').classList.remove('show');
    fp.style.display = 'none';
    animating = false;
    updateModeUI();
    renderB();
    renderLabels();
    updUI();
}

function setSocialTab(tab) {
    activeSocialTab = tab;
    document.getElementById('stab-friends').classList.toggle('active', tab === 'friends');
    document.getElementById('stab-challenges').classList.toggle('active', tab === 'challenges');
    document.getElementById('social-tab-friends').style.display = tab === 'friends' ? 'block' : 'none';
    document.getElementById('social-tab-challenges').style.display = tab === 'challenges' ? 'block' : 'none';
}

async function handleAddFriend(event) {
    event.preventDefault();
    const activeUser = localStorage.getItem('currentUser');
    const targetUser = document.getElementById('friend-username-input').value.trim();
    const msgEl = document.getElementById('add-friend-message');
    
    msgEl.style.display = 'none';
    msgEl.className = 'social-msg';
    
    if (activeUser === targetUser) {
        msgEl.textContent = "You cannot add yourself as a friend.";
        msgEl.classList.add('error');
        msgEl.style.display = 'block';
        return;
    }
    
    if (!window.firebaseReady || !window.db) return;
    
    try {
        const userDoc = await db.collection('users').doc(targetUser).get();
        if (!userDoc.exists) {
            msgEl.textContent = "User '" + targetUser + "' does not exist.";
            msgEl.classList.add('error');
            msgEl.style.display = 'block';
            return;
        }
        
        const checkDoc = await db.collection('users').doc(activeUser).collection('friends').doc(targetUser).get();
        if (checkDoc.exists) {
            const rel = checkDoc.data();
            if (rel.status === 'friend') {
                msgEl.textContent = targetUser + " is already your friend.";
            } else if (rel.status === 'sent') {
                msgEl.textContent = "Friend request already sent to " + targetUser + ".";
            } else if (rel.status === 'received') {
                msgEl.textContent = "You have a pending friend request from " + targetUser + ". Please accept it.";
            }
            msgEl.classList.add('error');
            msgEl.style.display = 'block';
            return;
        }
        
        const batch = db.batch();
        batch.set(db.collection('users').doc(activeUser).collection('friends').doc(targetUser), {
            status: 'sent',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        batch.set(db.collection('users').doc(targetUser).collection('friends').doc(activeUser), {
            status: 'received',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        await batch.commit();
        
        msgEl.textContent = "Friend request sent to " + targetUser + "!";
        msgEl.classList.add('success');
        msgEl.style.display = 'block';
        document.getElementById('friend-username-input').value = '';
    } catch (err) {
        console.error("Error adding friend:", err);
        msgEl.textContent = "An error occurred. Please try again.";
        msgEl.classList.add('error');
        msgEl.style.display = 'block';
    }
}

function startSocialHubListener() {
    if (socialUnsubscribe) socialUnsubscribe();
    
    const activeUser = localStorage.getItem('currentUser');
    if (!activeUser || !window.firebaseReady || !window.db) return;
    
    socialUnsubscribe = db.collection('users').doc(activeUser).collection('friends')
        .onSnapshot(snapshot => {
            const friends = [];
            snapshot.forEach(doc => {
                friends.push({ username: doc.id, ...doc.data() });
            });
            renderSocialFriends(friends);
        }, err => {
            console.error("Friends subscription error:", err);
        });
}

function startChallengesListener() {
    if (challengesUnsubscribe) challengesUnsubscribe();
    const activeUser = localStorage.getItem('currentUser');
    if (!activeUser || !window.firebaseReady || !window.db) return;
    
    const activeChallenges = {};
    
    const updateList = () => {
        renderSocialChallenges(Object.values(activeChallenges));
    };
    
    const u1 = db.collection('challenges')
        .where('challenger', '==', activeUser)
        .where('status', 'in', ['pending', 'playing'])
        .onSnapshot(snapshot => {
            snapshot.forEach(doc => {
                activeChallenges[doc.id] = { id: doc.id, ...doc.data() };
            });
            snapshot.docChanges().forEach(change => {
                if (change.type === 'removed' || change.doc.data().status === 'completed') {
                    delete activeChallenges[change.doc.id];
                }
            });
            updateList();
        });
        
    const u2 = db.collection('challenges')
        .where('challenged', '==', activeUser)
        .where('status', 'in', ['pending', 'playing'])
        .onSnapshot(snapshot => {
            snapshot.forEach(doc => {
                activeChallenges[doc.id] = { id: doc.id, ...doc.data() };
            });
            snapshot.docChanges().forEach(change => {
                if (change.type === 'removed' || change.doc.data().status === 'completed') {
                    delete activeChallenges[change.doc.id];
                }
            });
            updateList();
        });
        
    challengesUnsubscribe = () => {
        u1();
        u2();
    };
}

function renderSocialFriends(friends) {
    const listEl = document.getElementById('friends-list');
    if (!listEl) return;
    
    if (friends.length === 0) {
        listEl.innerHTML = '<div class="social-placeholder">No friends or pending requests yet.</div>';
        return;
    }
    
    let html = '';
    friends.sort((a, b) => {
        if (a.status !== b.status) {
            const order = { 'received': 1, 'sent': 2, 'friend': 3 };
            return order[a.status] - order[b.status];
        }
        return a.username.localeCompare(b.username);
    });
    
    friends.forEach(f => {
        if (f.status === 'friend') {
            html += `
                <div class="social-item">
                    <span class="social-item-name">👤 ${f.username}</span>
                    <div class="social-item-actions">
                        <button class="social-btn social-btn-challenge" onclick="challengeFriend('${f.username}')">⚔️ Challenge</button>
                        <button class="social-btn social-btn-reject" onclick="removeFriend('${f.username}')">Remove</button>
                    </div>
                </div>
            `;
        } else if (f.status === 'received') {
            html += `
                <div class="social-item">
                    <span class="social-item-name">👤 ${f.username} <span class="social-item-badge pending-in">Received</span></span>
                    <div class="social-item-actions">
                        <button class="social-btn social-btn-accept" onclick="acceptFriendRequest('${f.username}')">Accept</button>
                        <button class="social-btn social-btn-reject" onclick="rejectFriendRequest('${f.username}')">Reject</button>
                    </div>
                </div>
            `;
        } else if (f.status === 'sent') {
            html += `
                <div class="social-item">
                    <span class="social-item-name">👤 ${f.username} <span class="social-item-badge pending-out">Sent</span></span>
                    <div class="social-item-actions">
                        <button class="social-btn social-btn-reject" onclick="rejectFriendRequest('${f.username}')">Cancel</button>
                    </div>
                </div>
            `;
        }
    });
    
    listEl.innerHTML = html;
}

function renderSocialChallenges(challenges) {
    const listEl = document.getElementById('challenges-list');
    if (!listEl) return;
    
    const activeList = challenges.filter(c => c.status !== 'completed');
    
    if (activeList.length === 0) {
        listEl.innerHTML = '<div class="social-placeholder">No active invites or games.</div>';
        return;
    }
    
    const activeUser = localStorage.getItem('currentUser');
    let html = '';
    
    activeList.forEach(c => {
        if (c.status === 'pending') {
            if (c.challenger === activeUser) {
                const invitee = c.challenged ? c.challenged : "Anyone (Open Link)";
                const linkUrl = window.location.origin + window.location.pathname + '?challengeId=' + c.id;
                html += `
                    <div class="social-item">
                        <div>
                            <div style="font-weight: 500;">Sent to: ${invitee}</div>
                            <div style="font-size: 0.75rem; color: var(--text-secondary);">Waiting for opponent</div>
                        </div>
                        <div class="social-item-actions">
                            <button class="social-btn social-btn-challenge" onclick="showChallengeLinkModal('${linkUrl}')">🔗 Link</button>
                            <button class="social-btn social-btn-reject" onclick="cancelChallenge('${c.id}')">Cancel</button>
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div class="social-item">
                        <div>
                            <div style="font-weight: 500;">From: ${c.challenger}</div>
                            <div style="font-size: 0.75rem; color: var(--text-secondary);">Challenged you to a match!</div>
                        </div>
                        <div class="social-item-actions">
                            <button class="social-btn social-btn-accept" onclick="acceptChallenge('${c.id}')">🎮 Accept</button>
                            <button class="social-btn social-btn-reject" onclick="cancelChallenge('${c.id}')">Decline</button>
                        </div>
                    </div>
                `;
            }
        } else if (c.status === 'playing') {
            const oppName = c.challenger === activeUser ? c.challenged : c.challenger;
            html += `
                <div class="social-item" style="border-color: var(--glass-border-highlight);">
                    <div>
                        <div style="font-weight: 500; color: var(--accent-secondary);">⚔️ vs ${oppName}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">${c.turn === 'w' ? 'White' : 'Black'}'s turn</div>
                    </div>
                    <div class="social-item-actions">
                        <button class="social-btn social-btn-accept" onclick="resumeChallenge('${c.id}')">Play</button>
                    </div>
                </div>
            `;
        }
    });
    
    listEl.innerHTML = html;
}

async function acceptFriendRequest(friendUsername) {
    const activeUser = localStorage.getItem('currentUser');
    if (!window.firebaseReady || !window.db) return;
    
    try {
        const batch = db.batch();
        batch.update(db.collection('users').doc(activeUser).collection('friends').doc(friendUsername), {
            status: 'friend',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        batch.update(db.collection('users').doc(friendUsername).collection('friends').doc(activeUser), {
            status: 'friend',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await batch.commit();
    } catch (err) {
        console.error("Failed to accept friend request:", err);
    }
}

async function rejectFriendRequest(friendUsername) {
    const activeUser = localStorage.getItem('currentUser');
    if (!window.firebaseReady || !window.db) return;
    
    try {
        const batch = db.batch();
        batch.delete(db.collection('users').doc(activeUser).collection('friends').doc(friendUsername));
        batch.delete(db.collection('users').doc(friendUsername).collection('friends').doc(activeUser));
        await batch.commit();
    } catch (err) {
        console.error("Failed to reject friend request:", err);
    }
}

async function removeFriend(friendUsername) {
    if (confirm("Are you sure you want to remove " + friendUsername + " from your friends list?")) {
        rejectFriendRequest(friendUsername);
    }
}

async function challengeFriend(friendUsername) {
    const activeUser = localStorage.getItem('currentUser');
    if (!window.firebaseReady || !window.db) return;
    
    try {
        init();
        
        const newChallenge = {
            challenger: activeUser,
            challenged: friendUsername,
            challengerColor: 'w',
            status: 'pending',
            board: board,
            turn: 'w',
            mhist: [],
            lf: null,
            lt: null,
            ep: null,
            cr: { wK: true, wQ: true, bK: true, bQ: true },
            over: false,
            winner: null,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('challenges').add(newChallenge);
        alert("Challenge sent to " + friendUsername + "! Waiting for them to accept.");
        setSocialTab('challenges');
    } catch (err) {
        console.error("Failed to challenge friend:", err);
    }
}

async function createChallengeLink() {
    const activeUser = localStorage.getItem('currentUser');
    if (!window.firebaseReady || !window.db) return;
    
    try {
        init();
        
        const newChallenge = {
            challenger: activeUser,
            challenged: null,
            challengerColor: 'w',
            status: 'pending',
            board: board,
            turn: 'w',
            mhist: [],
            lf: null,
            lt: null,
            ep: null,
            cr: { wK: true, wQ: true, bK: true, bQ: true },
            over: false,
            winner: null,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        const docRef = await db.collection('challenges').add(newChallenge);
        const linkUrl = window.location.origin + window.location.pathname + '?challengeId=' + docRef.id;
        
        showChallengeLinkModal(linkUrl);
    } catch (err) {
        console.error("Failed to create invite link:", err);
    }
}

async function cancelChallenge(challengeId) {
    if (!window.firebaseReady || !window.db) return;
    try {
        await db.collection('challenges').doc(challengeId).delete();
    } catch (err) {
        console.error("Failed to cancel challenge:", err);
    }
}

async function acceptChallenge(challengeId) {
    const activeUser = localStorage.getItem('currentUser');
    if (!window.firebaseReady || !window.db) return;
    
    try {
        await db.collection('challenges').doc(challengeId).update({
            status: 'playing',
            challenged: activeUser,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        resumeChallenge(challengeId);
    } catch (err) {
        console.error("Failed to accept challenge:", err);
    }
}

function resumeChallenge(challengeId) {
    const activeUser = localStorage.getItem('currentUser');
    if (!window.firebaseReady || !window.db) return;
    
    db.collection('challenges').doc(challengeId).get().then(doc => {
        if (!doc.exists) return;
        const data = doc.data();
        
        activeChallengeId = challengeId;
        gameMode = 'human';
        
        if (data.challenger === activeUser) {
            myPlayerColor = data.challengerColor;
            opponentUsername = data.challenged;
        } else if (data.challenged === activeUser) {
            myPlayerColor = data.challengerColor === 'w' ? 'b' : 'w';
            opponentUsername = data.challenger;
        }
        
        flipped = (myPlayerColor === 'b');
        
        board = data.board;
        turn = data.turn;
        mhist = data.mhist;
        lf = data.lf;
        lt = data.lt;
        ep = data.ep;
        cr = data.cr;
        over = data.over;
        
        document.getElementById('btn-resign-game').style.display = 'inline-block';
        
        navigateTo('game');
        newGameMultiplayer();
        listenToChallenge(challengeId);
    });
}

function showChallengeLinkModal(url) {
    document.getElementById('challenge-link-input').value = url;
    document.getElementById('challenge-link-overlay').classList.add('open');
}

function closeChallengeLinkModal() {
    document.getElementById('challenge-link-overlay').classList.remove('open');
}

function copyChallengeLinkText() {
    const input = document.getElementById('challenge-link-input');
    input.select();
    input.setSelectionRange(0, 99999);
    
    try {
        navigator.clipboard.writeText(input.value).then(() => {
            alert("Invite link copied to clipboard!");
        });
    } catch (err) {
        document.execCommand('copy');
        alert("Invite link copied to clipboard!");
    }
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

// Check URL for challenge invitations on startup
checkURLChallenge();