(function () {
    'use strict';

    if (window.ua_catalog_plugin_v2) return;
    window.ua_catalog_plugin_v2 = true;

    var network = new Lampa.Reguest();

    // ===== Джерела + розділи =====
    var SOURCES = {
        uaserial: {
            title: 'UA Серіал',
            host: 'https://uaserial.tv',
            sections: [
                { title: 'Новинки',       url: 'https://uaserial.tv/' },
                { title: 'Фільми',        url: 'https://uaserial.tv/movie' },
                { title: 'Серіали',       url: 'https://uaserial.tv/serial' },
                { title: 'Мультфільми',   url: 'https://uaserial.tv/cartoon-movie' },
                { title: 'Мультсеріали',  url: 'https://uaserial.tv/cartoon-series' },
                { title: 'Аніме',         url: 'https://uaserial.tv/anime' }
            ]
        },
        eneyida: {
            title: 'Енеїда',
            host: 'https://eneyida.tv',
            sections: [
                { title: 'Новинки',       url: 'https://eneyida.tv/' },
                { title: 'Фільми',        url: 'https://eneyida.tv/films/' },
                { title: 'Серіали',       url: 'https://eneyida.tv/series/' },
                { title: 'Мультфільми',   url: 'https://eneyida.tv/cartoons/' }
            ]
        },
        kinoukr: {
            title: 'КіноУкр',
            host: 'https://kinoukr.tv',
            sections: [
                { title: 'Новинки',       url: 'https://kinoukr.tv/' },
                { title: 'Фільми',        url: 'https://kinoukr.tv/filmss/' },
                { title: 'Серіали',       url: 'https://kinoukr.tv/series/' },
                { title: 'Мультфільми',   url: 'https://kinoukr.tv/cartoonss/' },
                { title: 'Мультсеріали',  url: 'https://kinoukr.tv/cartoon-seriess/' }
            ]
        },
        rezka: {
            title: 'Rezka',
            host: 'https://rezka.ag',
            sections: [
                { title: 'Головна', url: 'https://rezka.ag/' }
            ]
        },
        filmix: {
            title: 'Filmix',
            host: 'https://filmix.my',
            sections: [
                { title: 'Головна', url: 'https://filmix.my/' }
            ]
        },
        aniliberty: {
            title: 'AniLiberty',
            host: 'https://aniliberty.top',
            sections: [
                { title: 'Головна', url: 'https://aniliberty.top/' }
            ]
        }
    };

    // ===== Парсери =====
    function cleanTitle(t) {
        return (t || '').replace(/\s+/g, ' ').trim();
    }

    function parseUaserial(html, host) {
        var items = [];
        var seen = {};

        // Типові картки: назва + англ. назва + рік
        var re = /([А-Яа-яЇїІіЄєҐґA-Za-z0-9:«»""'\-\s]{4,80})\s*\n\s*([A-Za-z0-9:«»""'\-\s]{3,80})\s*\n\s*[\d.]+\s*\n\s*(20\d{2})/g;
        var m;
        while ((m = re.exec(html)) !== null) {
            var title = cleanTitle(m[1]);
            var orig  = cleanTitle(m[2]);
            var year  = m[3];
            if (title.length < 3 || seen[title]) continue;
            // відсікаємо службові слова
            if (/^(Дивитися|Трейлер|Жанр|Студія|Фільми|Серіали|Мульт)/i.test(title)) continue;
            seen[title] = true;
            items.push({
                title: title,
                original_title: orig || title,
                year: year,
                img: '',
                url: host
            });
        }

        // Запасний варіант — просто заголовки
        if (items.length < 8) {
            var re2 = />([А-Яа-яЇїІіЄєҐґA-Za-z0-9:«»""'\-\s]{5,70})</g;
            while ((m = re2.exec(html)) !== null) {
                var t = cleanTitle(m[1]);
                if (t.length < 4 || seen[t]) continue;
                if (/^(Дивитися|Трейлер|Жанр|Студія|Фільми|Серіали|Мульт|Аніме|Топ)/i.test(t)) continue;
                seen[t] = true;
                items.push({ title: t, original_title: t, year: '', img: '', url: host });
            }
        }
        return items.slice(0, 36);
    }

    function parseEneyida(html) {
        var items = [];
        var seen = {};
        var re = /href="(https:\/\/eneyida\.tv\/\d+-[^"]+\.html)"[^>]*>([^<]{3,90})</gi;
        var m;
        while ((m = re.exec(html)) !== null) {
            if (seen[m[1]]) continue;
            seen[m[1]] = true;
            var title = cleanTitle(m[2]);
            if (title.length < 2) continue;
            items.push({
                title: title,
                original_title: title,
                year: '',
                img: '',
                url: m[1]
            });
        }
        return items.slice(0, 36);
    }

    function parseKinoukr(html) {
        var items = [];
        var seen = {};
        var re = /href="(https:\/\/kinoukr\.tv\/\d+-[^"]+\.html)"[^>]*>([^<]{3,100})</gi;
        var m;
        while ((m = re.exec(html)) !== null) {
            if (seen[m[1]]) continue;
            seen[m[1]] = true;
            var title = cleanTitle(m[2]);
            if (title.length < 2) continue;
            items.push({
                title: title,
                original_title: title,
                year: '',
                img: '',
                url: m[1]
            });
        }
        return items.slice(0, 36);
    }

    function parseGeneric(html, host) {
        var items = [];
        var seen = {};
        var re = /href="([^"]+)"[^>]*>([^<]{4,80})</gi;
        var m;
        while ((m = re.exec(html)) !== null) {
            var href = m[1];
            var title = cleanTitle(m[2]);
            if (title.length < 4 || seen[title]) continue;
            if (!/film|movie|serial|anime|watch|cart|мульт/i.test(href) && title.length < 8) continue;
            if (href.indexOf('http') !== 0) href = host + (href[0] === '/' ? '' : '/') + href;
            seen[title] = true;
            items.push({ title: title, original_title: title, year: '', img: '', url: href });
        }
        return items.slice(0, 30);
    }

    function parsePage(sourceKey, html, host) {
        if (sourceKey === 'uaserial') return parseUaserial(html, host);
        if (sourceKey === 'eneyida')  return parseEneyida(html);
        if (sourceKey === 'kinoukr')  return parseKinoukr(html);
        return parseGeneric(html, host);
    }

    // ===== Компонент каталогу =====
    function Catalog(object) {
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var html   = $('<div class="category-full"></div>');
        var body   = $('<div class="category-full__body"></div>');
        var sourceKey = object.source || 'uaserial';
        var source = SOURCES[sourceKey];
        var loaded = 0;
        var total  = source.sections.length;

        this.create = function () {
            this.activity.loader(true);
            body.empty();

            source.sections.forEach(function (sec) {
                network.silent(sec.url, function (pageHtml) {
                    var items = parsePage(sourceKey, pageHtml || '', source.host);
                    if (items.length) {
                        appendLine(sec.title + ' — ' + source.title, items);
                    }
                    loaded++;
                    if (loaded >= total) {
                        if (!body.children().length) {
                            body.append('<div class="empty__text">Не вдалося завантажити розділи. Спробуйте пізніше або VPN.</div>');
                        }
                        this.activity.loader(false);
                        this.activity.toggle();
                    }
                }.bind(this), function () {
                    loaded++;
                    if (loaded >= total) {
                        if (!body.children().length) {
                            body.append('<div class="empty__text">Помилка завантаження розділів.</div>');
                        }
                        this.activity.loader(false);
                        this.activity.toggle();
                    }
                }.bind(this));
            }.bind(this));
        };

        function appendLine(title, items) {
            var line = $('<div class="category-line" style="margin-bottom:1.5em"><div class="category-line__title" style="padding:0.6em 1em;font-weight:600">' + title + '</div><div class="category-line__body" style="display:flex;flex-wrap:wrap;gap:0.8em;padding:0 0.5em"></div></div>');
            var cont = line.find('.category-line__body');

            items.forEach(function (item) {
                var card = Lampa.Template.get('card', {
                    title: item.title,
                    release_year: item.year || ''
                });

                card.addClass('card--collection selector');
                if (item.img) {
                    card.find('.card__img').css('background-image', 'url(' + item.img + ')');
                }

                card.on('hover:enter', function () {
                    // Відкриваємо стандартну картку Lampa → Online / Torrents працюють
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

    // ===== Меню =====
    function openSourceSelect() {
        var items = Object.keys(SOURCES).map(function (key) {
            return { title: SOURCES[key].title, source: key };
        });

        Lampa.Select.show({
            title: 'UA Каталог — оберіть джерело',
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
            onBack: function () {
                Lampa.Controller.toggle('menu');
            }
        });
    }

    function addMenuButton() {
        if ($('.menu .menu__item[data-ua-catalog]').length) return;

        var button = $(`
            <li class="menu__item selector" data-ua-catalog="1">
                <div class="menu__ico">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
                    </svg>
                </div>
                <div class="menu__text">UA Каталог</div>
            </li>
        `);

        button.on('hover:enter', openSourceSelect);
        $('.menu .menu__list').eq(0).append(button);
    }

    if (window.appready) addMenuButton();
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') addMenuButton();
        });
    }
})();
