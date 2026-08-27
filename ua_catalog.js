(function () {
    'use strict';

    if (window.ua_catalog_plugin_v3) return;
    window.ua_catalog_plugin_v3 = true;

    var network = new Lampa.Reguest();
    network.timeout(15000);

    // Тільки перевірені / найстабільніші URL
    var SOURCES = {
        uaserial: {
            title: 'UA Серіал',
            host: 'https://uaserial.tv',
            sections: [
                { title: 'Новинки',      url: 'https://uaserial.tv/' },
                { title: 'Фільми',       url: 'https://uaserial.tv/movie' },
                { title: 'Серіали',      url: 'https://uaserial.tv/serial' },
                { title: 'Мультфільми',  url: 'https://uaserial.tv/cartoon-movie' },
                { title: 'Мультсеріали', url: 'https://uaserial.tv/cartoon-series' }
            ]
        },
        eneyida: {
            title: 'Енеїда',
            host: 'https://eneyida.tv',
            sections: [
                { title: 'Новинки', url: 'https://eneyida.tv/' }
                // інші розділи часто 404 або змінюються — залишаємо головну
            ]
        },
        kinoukr: {
            title: 'КіноУкр',
            host: 'https://kinoukr.tv',
            sections: [
                { title: 'Новинки',      url: 'https://kinoukr.tv/' },
                { title: 'Фільми',       url: 'https://kinoukr.tv/filmss/' },
                { title: 'Серіали',      url: 'https://kinoukr.tv/series/' },
                { title: 'Мультфільми',  url: 'https://kinoukr.tv/cartoonss/' }
            ]
        }
    };

    function cleanTitle(t) {
        return (t || '').replace(/\s+/g, ' ').replace(/&nbsp;/g, ' ').trim();
    }

    function parseUaserial(html) {
        var items = [], seen = {};
        // Назви з карток (українська + англійська + рік)
        var blocks = html.split(/Дивитися|Трейлер/i);
        blocks.forEach(function (block) {
            var m = block.match(/([А-Яа-яЇїІіЄєҐґA-Za-z0-9:«»""'\-\.,!\?]{4,70})\s+([A-Za-z][A-Za-z0-9:«»""'\-\.,!\? ]{2,60})\s+(\d\.\d|\d)\s+(20\d{2})/);
            if (!m) {
                m = block.match(/([А-Яа-яЇїІіЄєҐґA-Za-z0-9:«»""'\-\.,!\?]{5,70})\s+(20\d{2})/);
            }
            if (!m) return;
            var title = cleanTitle(m[1]);
            if (title.length < 3 || seen[title]) return;
            if (/^(Жанр|Студія|Фільми|Серіали|Мульт|Аніме|Топ|Останн)/i.test(title)) return;
            seen[title] = true;
            items.push({
                title: title,
                original_title: m[2] && /[A-Za-z]/.test(m[2]) ? cleanTitle(m[2]) : title,
                year: (m[3] && m[3].length === 4) ? m[3] : (m[4] || ''),
                img: ''
            });
        });

        if (items.length < 6) {
            var re = />([А-Яа-яЇїІіЄєҐґ][^<]{4,65})</g, m2;
            while ((m2 = re.exec(html)) !== null) {
                var t = cleanTitle(m2[1]);
                if (t.length < 4 || seen[t]) continue;
                if (/Дивитися|Трейлер|Жанр|Студія|Фільми|Серіали|Мульт|Аніме|Збережен|Історія/i.test(t)) continue;
                seen[t] = true;
                items.push({ title: t, original_title: t, year: '', img: '' });
            }
        }
        return items.slice(0, 40);
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
            items.push({ title: title, original_title: title, year: '', img: '', url: m[1] });
        }
        return items.slice(0, 40);
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
            items.push({ title: title, original_title: title, year: '', img: '', url: m[1] });
        }
        return items.slice(0, 40);
    }

    function parsePage(key, html) {
        if (key === 'uaserial') return parseUaserial(html);
        if (key === 'eneyida')  return parseEneyida(html);
        if (key === 'kinoukr')  return parseKinoukr(html);
        return [];
    }

    // Надійний запит: silent → native → fallback
    function fetchPage(url, onOk, onFail) {
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

        try {
            network.silent(url, ok, function () {
                // друга спроба через native
                if (network.native) {
                    network.native(url, ok, fail);
                } else {
                    fail();
                }
            });
        } catch (e) {
            fail();
        }

        // таймаут безпеки
        setTimeout(function () {
            if (!done) fail();
        }, 16000);
    }

    function Catalog(object) {
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var html   = $('<div class="category-full"></div>');
        var body   = $('<div class="category-full__body"></div>');
        var sourceKey = object.source || 'uaserial';
        var source = SOURCES[sourceKey];
        var left = source.sections.length;
        var hasAny = false;

        this.create = function () {
            this.activity.loader(true);
            body.empty();

            if (!source || !source.sections.length) {
                body.append('<div class="empty__text">Немає розділів для цього джерела</div>');
                this.activity.loader(false);
                this.activity.toggle();
                return;
            }

            source.sections.forEach(function (sec) {
                fetchPage(sec.url, function (pageHtml) {
                    var items = parsePage(sourceKey, pageHtml || '');
                    if (items.length) {
                        hasAny = true;
                        appendLine(sec.title + ' — ' + source.title, items);
                    }
                    finishOne();
                }.bind(this), function () {
                    finishOne();
                }.bind(this));
            }.bind(this));

            var self = this;
            function finishOne() {
                left--;
                if (left > 0) return;

                if (!hasAny) {
                    body.append(
                        '<div class="empty__text" style="padding:2em;text-align:center">' +
                        'Не вдалося завантажити розділи.<br><br>' +
                        'Можливі причини:<br>' +
                        '• сайт блокує запити (Cloudflare / захист)<br>' +
                        '• потрібен VPN або проксі в налаштуваннях Lampa<br>' +
                        '• змінилася адреса сайту<br><br>' +
                        'Спробуйте інше джерело або увімкніть проксі.' +
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
                '<div class="category-line__title" style="padding:0.7em 1em;font-weight:600;font-size:1.15em">' + title + '</div>' +
                '<div class="category-line__body" style="display:flex;flex-wrap:wrap;gap:0.7em;padding:0 0.6em"></div>' +
                '</div>'
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

    function openSourceSelect() {
        var items = Object.keys(SOURCES).map(function (key) {
            return { title: SOURCES[key].title, source: key };
        });
        Lampa.Select.show({
            title: 'UA Каталог',
            items: items,
            onSelect: function (a) {
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
        button.on('hover:enter', openSourceSelect);
        $('.menu .menu__list').eq(0).append(button);
    }

    if (window.appready) addMenuButton();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') addMenuButton(); });
})();
