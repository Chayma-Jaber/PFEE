import { Directive, ElementRef, OnInit, OnDestroy } from '@angular/core';

@Directive({
	selector: '[appLazyLoadImage]',
	standalone: true
})
export class LazyLoadImageDirective implements OnInit, OnDestroy {
	private wrapperElement: HTMLDivElement | null = null;
	private overlayElement: HTMLDivElement | null = null;
	private loadListener: any;
	private errorListener: any;

	constructor(private el: ElementRef) { }

	ngOnInit() {
		const img = this.el.nativeElement as HTMLImageElement;

		// Configurer les attributs pour le lazy loading
		if ('loading' in HTMLImageElement.prototype) {
			img.setAttribute('loading', 'lazy');
		} else {
			this.lazyLoadWithIntersectionObserver(img);
		}

		// Accessibilité: alt vide si manquant
		if (!img.hasAttribute('alt') || img.getAttribute('alt') === '') {
			img.setAttribute('alt', '');
		}

		// Dimensions si disponibles immédiatement
		if (!img.hasAttribute('width') && !img.hasAttribute('height')) {
			if (img.naturalWidth && img.naturalHeight) {
				img.setAttribute('width', img.naturalWidth.toString());
				img.setAttribute('height', img.naturalHeight.toString());
			}
		}

		// Ajouter un loader visuel tant que l'image charge
		this.ensureLoaderStylesInjected();
		if (!img.complete || img.naturalWidth === 0) {
			this.installLoader(img);
		}
	}

	ngOnDestroy(): void {
		this.cleanup();
	}

	private installLoader(img: HTMLImageElement): void {
		const parent = img.parentElement;
		if (!parent) return;

		// Wrapper pour positionner l'overlay exactement à la place de l'image
		const wrapper = document.createElement('div');
		wrapper.className = 'image-loader-wrapper';
		wrapper.style.display = getComputedStyle(img).display === 'block' ? 'block' : 'inline-block';
		wrapper.style.position = 'relative';
		wrapper.style.width = img.style.width || '100%';
		wrapper.style.height = img.style.height || '';

		// Insérer le wrapper avant l'image puis y déplacer l'image
		parent.insertBefore(wrapper, img);
		wrapper.appendChild(img);
		this.wrapperElement = wrapper;

		// Image invisible le temps du chargement
		img.style.opacity = '0';
		img.style.transition = 'opacity 0.3s ease';

		// Overlay + spinner centré
		const overlay = document.createElement('div');
		overlay.className = 'image-loader-overlay';
		overlay.style.position = 'absolute';
		overlay.style.inset = '0';
		overlay.style.display = 'flex';
		overlay.style.alignItems = 'center';
		overlay.style.justifyContent = 'center';
		overlay.style.background = 'rgba(255,255,255,0.6)';
		overlay.style.pointerEvents = 'none';

		const spinner = document.createElement('div');
		spinner.className = 'image-loader-spinner';
		spinner.style.width = '32px';
		spinner.style.height = '32px';
		spinner.style.border = '3px solid rgba(0,0,0,0.15)';
		spinner.style.borderTopColor = '#6c757d';
		spinner.style.borderRadius = '50%';
		spinner.style.animation = 'image-loader-spin 1s linear infinite';
		overlay.appendChild(spinner);

		wrapper.appendChild(overlay);
		this.overlayElement = overlay;

		// Ecouter le chargement / erreur
		this.loadListener = () => {
			img.style.opacity = '1';
			this.removeOverlay();
		};
		this.errorListener = () => {

			// En cas d'erreur, on retire le loader mais on laisse l'image visible (alt/fallback gérés ailleurs)
			img.style.opacity = '1';
			this.removeOverlay();
		};
		img.addEventListener('load', this.loadListener, { once: true });
		img.addEventListener('error', this.errorListener, { once: true });
	}

	private removeOverlay(): void {
		if (this.overlayElement && this.overlayElement.parentElement) {
			this.overlayElement.parentElement.removeChild(this.overlayElement);
		}
		this.overlayElement = null;
	}

	private cleanup(): void {
		const img = this.el.nativeElement as HTMLImageElement;
		if (this.loadListener) {
			img.removeEventListener('load', this.loadListener);
			this.loadListener = null;
		}
		if (this.errorListener) {
			img.removeEventListener('error', this.errorListener);
			this.errorListener = null;
		}
	}

	private ensureLoaderStylesInjected(): void {
		const styleId = 'image-loader-global-styles';
		if (document.getElementById(styleId)) return;
		const style = document.createElement('style');
		style.id = styleId;
		style.textContent = `@keyframes image-loader-spin { to { transform: rotate(360deg); } }`;
		document.head.appendChild(style);
	}

	private lazyLoadWithIntersectionObserver(img: HTMLImageElement) {
		const options = {
			root: null, // viewport
			rootMargin: '0px',
			threshold: 0.1 // déclencher lorsque 10% de l'image est visible
		};

		const observer = new IntersectionObserver((entries, observerInstance) => {
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					if (img.dataset['src']) {
						(img as any)['src'] = img.dataset['src'] as string;
					}
					if (img.dataset['srcset']) {
						(img as any)['srcset'] = img.dataset['srcset'] as string;
					}
					observerInstance.unobserve(img);
				}
			});
		}, options);

		observer.observe(img);
	}
}