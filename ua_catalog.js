(function () {
    'use strict';

    if (window.ua_catalog_plugin_proxy) return;
    window.ua_catalog_plugin_proxy = true;

    var network = new Lampa.Reguest();
    network.timeout(20000);

    // Проксі: спочатку свій (ua_catalog_proxy), потім загальний Lampa
    function getProxy() {
        var p = Lampa.Storage.get('ua_catalog_proxy', '') || Lampa.Storage.get('online_proxy_all', '') || '';
        p = (p || '').trim();
        if (p && p.slice(-1) !== '/' && p.indexOf('?') === -1) p += '/';
        return p;
    }

    function withProxy(url) {
        var proxy = getProxy();
        if (!proxy) return url;

        // allorigins / raw?url=
        if (proxy.indexOf('allorigins') !== -1 || proxy.indexOf('raw?url=') !== -1) {
            return proxy.replace(/url=$/, 'url=') + encodeURIComponent(url);
        }
        // corsproxy.io/? 
        if (proxy.indexOf('corsproxy') !== -1 || proxy.indexOf('?') !== -1) {
            return proxy + encodeURIComponent(url);
        }
        // звичайний префікс-проксі: proxy + url
        return proxy + url;
    }

    var SOURCES = {
        eneyida: {
            title: 'Енеїда',
            host: 'https://eneyida.tv',
            useProxy: true,   // обов’язково через проксі
            sections: [
                { title: 'Новинки', url: 'https://eneyida.tv/' }
            ]
        },
        uaserial: {
            title: 'UA Серіал',
            host: 'https://uaserial.tv',
            useProxy: false,
            sections: [
                { title: 'Новинки',      url: 'https://uaserial.tv/' },
                { title: 'Фільми',       url: 'https://uaserial.tv/movie' },
                { title: 'Серіали',      url: 'https://uaserial.tv/serial' },
                { title: 'Мультфільми',  url: 'https://uaserial.tv/cartoon-movie' }
            ]
        },
        kinoukr: {
            title: 'КіноУкр',
            host: 'https://kinoukr.tv',
            useProxy: true,
            sections: [
                { title: 'Новинки',     url: 'https://kinoukr.tv/' },
                { title: 'Фільми',      url: 'https://kinoukr.tv/filmss/' },
                { title: 'Серіали',     url: 'https://kinoukr.tv/series/' },
                { title: 'Мультфільми', url: 'https://kinoukr.tv/cartoonss/' }
            ]
        }
    };

    function cleanTitle(t) {
        return (t || '').replace(/\s+/g, ' ').replace(/&nbsp;/g, ' ').trim();
    }

    function parseEneyida(html) {
        var items = [], seen = {};
        var re = /href="(https?:\/\/eneyida\.tv\/\d+-[^"]+\.html)"[^>]*>([^<]{3,90})</gi;
        var m;
        while ((m = re.exec(html)) !== null) {
            if (seen[m[1]]) continue;
            seen[m[1]] = true;
            var title = cleanTitle(m[2]);
            if (title.length < 2) continue;
            items.push({ title: title, original_title: title, year: '', url: m[1] });
        }
        // запасний пошук по тексту сторінки
        if (items.length < 5) {
            var re2 = /\[([^\]]{4,70})\]\((https?:\/\/eneyida\.tv\/\d+-[^)]+\.html)\)/g;
            while ((m = re2.exec(html)) !== null) {
                if (seen[m[2]]) continue;
                seen[m[2]] = true;
                items.push({ title: cleanTitle(m[1]), original_title: cleanTitle(m[1]), year: '', url: m[2] });
            }
        }
        return items.slice(0, 40);
    }

    function parseUaserial(html) {
        var items = [], seen = {};
        var re = />([А-Яа-яЇїІіЄєҐґ][^<]{4,65})</g, m;
        while ((m = re.exec(html)) !== null) {
            var t = cleanTitle(m[1]);
            if (t.length < 4 || seen[t]) continue;
            if (/Дивитися|Трейлер|Жанр|Студія|Фільми|Серіали|Мульт|Аніме|Збережен|Історія|Топ/i.test(t)) continue;
            seen[t] = true;
            items.push({ title: t, original_title: t, year: '' });
        }
        return items.slice(0, 36);
    }

    function parseKinoukr(html) {
        var items = [], seen = {};
        var re = /href="(https?:\/\/kinoukr\.tv\/\d+-[^"]+\.html)"[^>]*>([^<]{3,100})</gi;
        var m;
        while ((m = re.exec(html)) !== null) {
            if (seen[m[1]]) continue;
            seen[m[1]] = true;
            var title = cleanTitle(m[2]);
            if (title.length < 2) continue;
            items.push({ title: title, original_title: title, year: '', url: m[1] });
        }
        return items.slice(0, 40);
    }

    function parsePage(key, html) {
        if (key === 'eneyida')  return parseEneyida(html || '');
        if (key === 'uaserial') return parseUaserial(html || '');
        if (key === 'kinoukr')  return parseKinoukr(html || '');
        return [];
    }

    function fetchPage(url, useProxy, onOk, onFail) {
        var finalUrl = useProxy ? withProxy(url) : url;
        var done = false;

        function ok(data) {
            if (done) return;
            done = true;
            onOk(typeof data === 'string' ? data : (data || ''));
        }
        function fail() {
            if (done) return;
            done = true;
            onFail && onFail();
        }

        // 1) звичайний запит
        network.silent(finalUrl, ok, function () {
            // 2) якщо з проксі не вийшло і проксі був — спроба без нього
            if (useProxy && getProxy()) {
                network.silent(url, ok, function () {
                    if (network.native) network.native(url, ok, fail);
                    else fail();
                });
            } else if (network.native) {
                network.native(finalUrl, ok, fail);
            } else {
                fail();
            }
        });

        setTimeout(function () { if (!done) fail(); }, 18000);
    }

    function Catalog(object) {
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var html   = $('<div class="category-full"></div>');
        var body   = $('<div class="category-full__body"></div>');
        var sourceKey = object.source || 'eneyida';
        var source = SOURCES[sourceKey];
        var left = source.sections.length;
        var hasAny = false;

        this.create = function () {
            this.activity.loader(true);
            body.empty();

            var proxy = getProxy();
            if (source.useProxy && !proxy) {
                body.append(
                    '<div class="empty__text" style="padding:2em;text-align:center">' +
                    'Для <b>Енеїди</b> потрібен проксі.<br><br>' +
                    '1. Відкрий меню UA Каталог → «Налаштувати проксі»<br>' +
                    '2. Або в Lampa: Online → Проксі<br><br>' +
                    'Приклад: <code>https://corsproxy.io/?</code>' +
                    '</div>'
                );
                this.activity.loader(false);
                this.activity.toggle();
                return;
            }

            source.sections.forEach(function (sec) {
                fetchPage(sec.url, !!source.useProxy, function (pageHtml) {
                    var items = parsePage(sourceKey, pageHtml);
                    if (items.length) {
                        hasAny = true;
                        appendLine(sec.title + ' — ' + source.title, items);
                    }
                    finishOne();
                }, finishOne);
            });

            var self = this;
            function finishOne() {
                left--;
                if (left > 0) return;
                if (!hasAny) {
                    body.append(
                        '<div class="empty__text" style="padding:2em;text-align:center">' +
                        'Енеїда не відповіла навіть через проксі.<br><br>' +
                        'Спробуй інший проксі:<br>' +
                        '<code>https://corsproxy.io/?</code><br>' +
                        '<code>https://api.allorigins.win/raw?url=</code><br><br>' +
                        'Або увімкни VPN на пристрої.' +
                        '</div>'
                    );
                }
                self.activity.loader(false);
                self.activity.toggle();
            }
        };

        function appendLine(title, items) {
            var line = $(
                '<div class="category-line" style="margin-bottom:1.8em">' +
                '<div class="category-line__title" style="padding:0.7em 1em;font-weight:600">' + title + '</div>' +
                '<div class="category-line__body" style="display:flex;flex-wrap:wrap;gap:0.7em;padding:0 0.6em"></div></div>'
            );
            var cont = line.find('.category-line__body');
            items.forEach(function (item) {
                var card = Lampa.Template.get('card', {
                    title: item.title,
                    release_year: item.year || ''
                });
                card.addClass('card--collection selector');
                card.on('hover:enter', function () {
                    Lampa.Activity.push({
                        url: '',
                        title: item.title,
                        component: 'full',
                        search: item.title,
                        card: {
                            title: item.title,
                            original_title: item.original_title || item.title,
                            name: item.title,
                            release_year: item.year || ''
                        }
                    });
                });
                cont.append(card);
            });
            body.append(line);
        }

        this.start = function () {
            Lampa.Controller.add('content', {
                toggle: function () {
                    Lampa.Controller.collectionSet(scroll.render());
                    Lampa.Controller.collectionFocus(false, scroll.render());
                },
                left:  function () { if (Navigator.canmove('left')) Navigator.move('left'); else Lampa.Controller.toggle('menu'); },
                right: function () { Navigator.move('right'); },
                up:    function () { if (Navigator.canmove('up')) Navigator.move('up'); else Lampa.Controller.toggle('head'); },
                down:  function () { Navigator.move('down'); },
                back:  function () { Lampa.Activity.backward(); }
            });
            Lampa.Controller.toggle('content');
        };

        this.render = function () {
            scroll.append(body);
            html.append(scroll.render());
            return html;
        };
        this.pause = this.stop = function () {};
        this.destroy = function () {
            network.clear();
            scroll.destroy();
            html.remove();
        };
    }

    Lampa.Component.add('ua_catalog', Catalog);

    function setProxy() {
        Lampa.Input.edit({
            title: 'Проксі для UA Каталог',
            value: Lampa.Storage.get('ua_catalog_proxy', '') || 'https://corsproxy.io/?',
            free: true,
            nosave: true
        }, function (value) {
            value = (value || '').trim();
            Lampa.Storage.set('ua_catalog_proxy', value);
            Lampa.Noty.show(value ? 'Проксі збережено' : 'Проксі очищено');
        });
    }

    function openMenu() {
        var items = Object.keys(SOURCES).map(function (key) {
            return { title: SOURCES[key].title, source: key };
        });
        items.push({ title: '⚙️ Налаштувати проксі', action: 'proxy' });
        items.push({
            title: 'Проксі зараз: ' + (getProxy() || 'не задано'),
            disabled: true
        });

        Lampa.Select.show({
            title: 'UA Каталог',
            items: items,
            onSelect: function (a) {
                if (a.action === 'proxy') {
                    setProxy();
                    return;
                }
                Lampa.Activity.push({
                    url: '',
                    title: a.title,
                    component: 'ua_catalog',
                    source: a.source,
                    page: 1
                });
            },
            onBack: function () { Lampa.Controller.toggle('menu'); }
        });
    }

    function addMenuButton() {
        if ($('.menu .menu__item[data-ua-catalog]').length) return;
        var button = $(
            '<li class="menu__item selector" data-ua-catalog="1">' +
            '<div class="menu__ico"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg></div>' +
            '<div class="menu__text">UA Каталог</div></li>'
        );
        button.on('hover:enter', openMenu);
        $('.menu .menu__list').eq(0).append(button);
    }

    if (window.appready) addMenuButton();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') addMenuButton(); });
})();
