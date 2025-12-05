/*
	Consolidated site script
	- Combines behaviors from previous `Carpeta javacrit/script.js` and `js/script.js`
	- Keeps behavior intact: menu toggle (click/pointer/touch), outside-click close, aria-expanded
	- Active link highlighting (click + scroll), smooth anchor scrolling
	- Progress bar animation using IntersectionObserver when possible
	- Map toggle, contact form handling, copy-email toast, card flip, download pressed
*/
(function(){
	'use strict';

	// Helpers
	const safeQuery = (sel, root=document) => root.querySelector(sel);
	const safeQueryAll = (sel, root=document) => Array.from(root.querySelectorAll(sel));

	// Menu toggle: robust handlers for click/pointer/touch + keyboard
	// Fix: avoid double-trigger on mobile where touchstart -> pointerdown -> click
	// can fire multiple times. We ignore synthetic click/pointer events that
	// occur shortly after a touchstart.
	const initMenu = () => {
		const toggle = safeQuery('.menu-toggle');
		const navUl = safeQuery('nav ul');
		if (!toggle || !navUl) return;

		const setExpanded = (v) => toggle.setAttribute('aria-expanded', v ? 'true' : 'false');

		const TOUCH_IGNORE_MS = 900; // ms to consider events as part of same touch (increased per user request)
		let lastTouch = 0;

		const toggleMenu = (e) => {
			// If this is a click or pointer event that directly follows a touch,
			// ignore it to prevent immediate reopen/close.
			if (e && (e.type === 'click' || e.type === 'pointerdown')) {
				if (Date.now() - lastTouch < TOUCH_IGNORE_MS) return;
			}

			// Record touch occurrences so subsequent events can be ignored.
			if (e && e.type === 'touchstart') { e.preventDefault(); lastTouch = Date.now(); }
			if (e && e.type === 'pointerdown' && e.pointerType === 'touch') { lastTouch = Date.now(); }

			const now = navUl.classList.toggle('show');
			setExpanded(now);
		};

		if (toggle.dataset._menuAttached === 'true' || toggle.dataset.toggleAttached === 'true') return;
		toggle.dataset._menuAttached = 'true';
		toggle.dataset.toggleAttached = 'true';

		// Attach handlers. Prefer Pointer Events when available to unify
		// mouse/touch/pen input and avoid duplicate synthetic events.
		if (window.PointerEvent) {
			// Use passive:false so we can preventDefault for touch pointerType
			toggle.addEventListener('pointerdown', (e) => {
				if (e.pointerType === 'touch') e.preventDefault();
				toggleMenu(e);
			}, { passive: false });
		} else {
			// Fallback for older browsers: handle touchstart and click
			toggle.addEventListener('touchstart', (e) => { e.preventDefault(); toggleMenu(e); }, { passive: false });
			toggle.addEventListener('click', toggleMenu);
		}
		toggle.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMenu(e); } });

		// close when clicking outside
		document.addEventListener('click', (e) => {
			if (!navUl.classList.contains('show')) return;
			if (!e.target.closest('nav')) {
				navUl.classList.remove('show');
				setExpanded(false);
			}
		});
		// close on Escape
		document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && navUl.classList.contains('show')) { navUl.classList.remove('show'); setExpanded(false); } });
	};

	// Active link handling (click delegation + scroll)
	const initActiveLinks = () => {
		const navLinks = safeQueryAll('nav ul li a');
		document.addEventListener('click', (e) => {
			const a = e.target.closest && e.target.closest('nav ul li a');
			if (!a) return;
			const href = a.getAttribute('href') || '';
			if (href.startsWith('#')) {
				e.preventDefault();
				const target = document.querySelector(href);
				if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}
			navLinks.forEach(l => l.classList.remove('active'));
			a.classList.add('active');
			const navUl = safeQuery('nav ul'); if (navUl && navUl.classList.contains('show')) navUl.classList.remove('show');
		});

		const sections = safeQueryAll('section[id]');
		if (sections.length) {
			window.addEventListener('scroll', () => {
				const y = window.scrollY + 120;
				for (const sec of sections) {
					const top = sec.offsetTop;
					const height = sec.offsetHeight;
					const id = sec.getAttribute('id');
					const link = document.querySelector(`nav ul li a[href="#${id}"]`);
					if (y >= top && y < top + height) {
						if (link) { navLinks.forEach(l => l.classList.remove('active')); link.classList.add('active'); }
					}
				}
			}, { passive: true });
		}
	};

	// Progress bars animation
	const animateProgressBars = (speed=12) => {
		safeQueryAll('.progress-bar').forEach(bar=>{
			const target = parseInt(bar.dataset.progress || bar.getAttribute('data-progress') || 0, 10) || 0;
			let w=0; const id = setInterval(()=>{ if(w>=target) clearInterval(id); else { w++; bar.style.width = w+'%'; bar.textContent = w+'%'; } }, speed);
		});
	};

	const initProgressObserver = () => {
		const habilidades = document.getElementById('habilidades');
		if (habilidades) {
			let animated=false;
			const obs = new IntersectionObserver(entries => { entries.forEach(entry=>{ if(entry.isIntersecting && !animated){ animateProgressBars(); animated=true; obs.disconnect(); } }); }, { threshold: 0.25 });
			obs.observe(habilidades);
		} else {
			animateProgressBars();
		}
	};

	// Map toggle
	const initMapToggle = () => {
		const mapToggleBtn = document.getElementById('map-toggle-btn');
		const mapResponsive = document.querySelector('.map-responsive');
		if (!mapToggleBtn || !mapResponsive) return;
		mapToggleBtn.addEventListener('click', ()=>{
			mapResponsive.classList.toggle('expanded');
			const expanded = mapResponsive.classList.contains('expanded');
			mapToggleBtn.textContent = expanded ? 'Ver mapa compacto' : 'Ver mapa completo';
			const top = mapResponsive.getBoundingClientRect().top + window.scrollY - 80; window.scrollTo({ top, behavior: 'smooth' });
		});
	};

	// Contact form handling + copy email + toast
	const initContactHelpers = () => {
		const toast = document.getElementById('contact-toast');
		const copyBtn = document.getElementById('copy-email-btn');
		const emailLink = document.getElementById('direct-email-link');

		const showToast = (msg, duration=3000) => {
			if (!toast) return; toast.textContent = msg; toast.classList.remove('sr-only'); toast.style.opacity='1'; setTimeout(()=>{ toast.style.opacity='0'; setTimeout(()=>toast.classList.add('sr-only'),300); }, duration);
		};

		if (copyBtn && emailLink) {
			copyBtn.addEventListener('click', async ()=>{
				const email = (emailLink.getAttribute('href')||'').replace('mailto:','') || emailLink.dataset.email;
				try { await navigator.clipboard.writeText(email); showToast('Correo copiado al portapapeles'); } catch (err) { showToast('No se pudo copiar. Selecciona el correo manualmente.'); }
			});
		}

		const form = document.getElementById('contact-form');
		if (form) {
			form.addEventListener('submit', (e)=>{
				const actionUrl = form.getAttribute('action')||'';
				if (!actionUrl) { e.preventDefault(); showToast('No hay destino configurado para el formulario'); return; }
				showToast('Enviando mensaje...');
			});
		}
	};

	// Download button pressed state
	const initDownloadButtons = () => {
		const downloadButtons = safeQueryAll('.download-wrap a');
		downloadButtons.forEach(btn=>{
			const add = ()=>btn.classList.add('pressed');
			const remove = ()=>btn.classList.remove('pressed');
			btn.addEventListener('touchstart', add, { passive: true }); btn.addEventListener('mousedown', add);
			btn.addEventListener('touchend', remove); btn.addEventListener('mouseup', remove); btn.addEventListener('mouseleave', remove);
			btn.addEventListener('click', ()=>setTimeout(remove,600));
		});
	};

	// Card flip interactions
	const initCards = () => {
		const cards = safeQueryAll('.card');
		cards.forEach(card=>{
			card.addEventListener('click', ()=>card.classList.toggle('is-flipped'));
			if (!card.hasAttribute('tabindex')) card.setAttribute('tabindex','0');
			card.addEventListener('keydown',(e)=>{ if (e.key==='Enter' || e.key===' ') { e.preventDefault(); card.classList.toggle('is-flipped'); } });
		});
	};

	// Init all when DOM ready
	document.addEventListener('DOMContentLoaded', ()=>{
		initMenu(); initActiveLinks(); initProgressObserver(); initMapToggle(); initContactHelpers(); initDownloadButtons(); initCards();
	});

})();

