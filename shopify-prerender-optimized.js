(() => {
    if (!HTMLScriptElement.supports?.('speculationrules')) return;

    const PRERENDER_CONFIG = {
        product: {
            selectors: [
                '[href*="/products/"]',
                '.product-card a', 
                '.product-grid a',
                '.product-link',
                '.product-recommendations a',
                '.featured-products a'
            ],
            rules: {
                exclude: [
                    '[data-add-to-cart]',
                    '[data-variant-selector]',
                    '**/admin/**',
                    '**/*add*',
                    '**/*remove*',
                    '**/*update*',
                    '**/*change*',
                    '**/*cart*'
                ]
            }
        },
        collection: {
            selectors: [
                '[href*="/collections/"]',
                '.collection-nav a',
                '.collection-card a',
                '.collection-link'
            ]
        },
        cart: {
            selectors: [
                '[name="checkout"]',
                '[href*="/checkout"]',
                '[href*="/cart"]'
            ]
        }
    };

    function addStaticPrerenderRules() {
        const specScript = document.createElement('script');
        specScript.type = 'speculationrules';

        const rules = {
            prerender: [{
                where: {
                    and: [
                        { href_matches: '*/collections/*' },
                        { not: { href_matches: '*/collections/*/products/*' }},
                        { not: { href_matches: '*/collections/*/edit' }},
                        { not: { selector_matches: '.no-prerender, [data-no-prerender]' }}
                    ]
                },
                eagerness: 'conservative'
            },
            {
                where: {
                    and: [
                        { href_matches: '*/products/*' },
                        { not: { href_matches: '*/products/*/edit' }},
                        { not: { selector_matches: '.no-prerender, [data-no-prerender]' }}
                    ]
                },
                eagerness: 'moderate'
            }]
        };

        specScript.textContent = JSON.stringify(rules);
        document.head.appendChild(specScript);
    }

    function addDynamicPrerenderRules(urls) {
        if (!Array.isArray(urls) || !urls.length) return;
        
        const specScript = document.createElement('script');
        specScript.type = 'speculationrules';
        
        const rules = {
            prerender: [{
                urls: urls.slice(0, 5),
                eagerness: 'moderate'
            }]
        };

        specScript.textContent = JSON.stringify(rules);
        document.body.appendChild(specScript);
    }

    function handleHover(event) {
        const link = event.target.closest('a');
        if (!link || link.dataset.prerendered) return;

        const href = link.href;
        if (!href || 
            href.includes('/admin/') || 
            href.includes('?') || 
            href.includes('/cart') || 
            href.includes('checkout')) return;

        link.dataset.prerendered = 'true';
        addDynamicPrerenderRules([href]);
    }

    function initProductPagePrerender() {
        if (!window.location.pathname.includes('/products/')) return;

        const productLinks = Array.from(document.querySelectorAll([
            '.next-product a',
            '.previous-product a',
            '.other-products a',
            '[data-product-link]'
        ].join(',')));

        const urlsToPrerender = productLinks
            .map(link => link?.href)
            .filter(url => url && !url.includes('?'));

        if (urlsToPrerender.length) {
            addDynamicPrerenderRules(urlsToPrerender);
        }
    }

    function initCollectionPagePrerender() {
        if (!window.location.pathname.includes('/collections/')) return;

        const visibleProducts = Array.from(
            document.querySelectorAll([
                '.product-card a',
                '.product-link',
                '[data-product-link]'
            ].join(','))
        ).slice(0, 3);

        const urlsToPrerender = visibleProducts
            .map(link => link?.href)
            .filter(url => url && !url.includes('?'));

        if (urlsToPrerender.length) {
            addDynamicPrerenderRules(urlsToPrerender);
        }
    }

    function monitorPerformance() {
        const whenActivated = new Promise((resolve) => {
            if (document.prerendering) {
                document.addEventListener('prerenderingchange', resolve, {once: true});
            } else {
                resolve();
            }
        });

        whenActivated.then(() => {
            try {
                const navEntry = performance.getEntriesByType('navigation')[0];
                if (navEntry?.activationStart > 0) {
                    console.debug(`[Prerender] Activation time: ${navEntry.activationStart}ms`);
                }
            } catch (e) {}
        });
    }

    function init() {
        try {
            addStaticPrerenderRules();

            Object.values(PRERENDER_CONFIG).forEach(config => {
                config.selectors?.forEach(selector => {
                    document.querySelectorAll(selector).forEach(element => {
                        element.addEventListener('mouseover', handleHover, { passive: true });
                    });
                });
            });

            initProductPagePrerender();
            initCollectionPagePrerender();
            monitorPerformance();

            const observer = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            Object.values(PRERENDER_CONFIG).forEach(config => {
                                config.selectors?.forEach(selector => {
                                    node.querySelectorAll(selector).forEach(element => {
                                        element.addEventListener('mouseover', handleHover, { passive: true });
                                    });
                                });
                            });
                        }
                    });
                });
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        } catch (e) {
            console.debug('[Prerender] Initialization error:', e);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
