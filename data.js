// The menu, typed out from the screenshots.
//
// Two levels sit above the food itself:
//
//   MENU      the two halves of the job - Food and Beverages
//   groups    a service within that half. Food has Lunch for now, with
//             Delectables and Light Dinner to come. Beverages has the four
//             parts of the drinks list
//   sections  a course or heading within one service, as printed
//   items     the dishes and drinks
//
// `speech: false` on a half switches off every pronunciation feature beneath
// it - the listen buttons and the written "sounds like" lines. Food is a
// memory job: which items are on, and what each one is. Only the drinks have
// to be said out loud, and there only as a reference while you read the list.
//
// An item carries:
//
//   name    exactly as the menu prints it, because that is what a passenger
//           reads and what you are expected to say back
//   desc    the description as printed. Where the screenshot cut the text off
//           mid-sentence the item is marked `partial` and the app says so,
//           rather than letting you learn half a sentence as the whole thing
//   say     a plain-English "sounds like", stressed SYLLABLE in capitals.
//           Drinks only
//   speak   what the voice should read, when that differs from the printed
//           name, paired with `lang` for the voice to use. The French wines are
//           unlistenable in an English voice - "Chateau Pey La Tour" comes out
//           as "chatoo pey la tower"

var MENU = [

  {
    id: 'food',
    name: 'Food',
    sub: 'What is on, and what each dish is',
    taste: 'Satay · Biryani · Chendol',
    speech: false,
    // Food is a shorter job than drinks. You read the menu, you describe a dish
    // when a passenger asks for it by name, and you can produce a whole course
    // on request. Working backwards from a description is a drinks problem.
    modes: ['list', 'what', 'recall'],
    groups: [

      {
        id: 'lunch',
        name: 'Lunch',
        sub: 'International Menu',
        sections: [

          { name: 'Canapé', items: [
            {
              name: 'Singapore Chicken Satay',
              desc: 'Chargrilled marinated chicken skewers, served with a spicy rich peanut sauce, cucumber, and onions'
            }
          ]},

          { name: 'Appetiser', items: [
            {
              name: 'Marinated Prawns with Cucumber Salad',
              desc: 'Marinated prawns, gently seasoned to enhance their natural sweetness, served with crisp cucumber and shaved fennel.',
              partial: true
            }
          ]},

          { name: 'Main Course', items: [
            {
              name: 'Slow Braised Beef Cheek with Truffle Mash Potatoes and Red Wine Jus',
              desc: 'This dish honours the rustic elegance of French bistro cooking, where humble beef cheek transforms through patient braising',
              partial: true
            },
            {
              name: 'Baked Halibut with Semi-dried Tomato Salsa',
              desc: 'Baked halibut fillet, delicately cooked to preserve its natural flakiness, and clean flavour, finished with a semi-dried tomato',
              partial: true
            },
            {
              name: 'Stir-Fried Chicken in Black Bean Sauce',
              desc: 'Tender chicken tossed in savoury black bean sauce, complemented by Asian vegetables, served alongside fragrant egg',
              partial: true
            },
            {
              name: 'Gosht Biryani',
              desc: 'Slow-cooked lamb curry layered with aromatic basmati rice, infused with warm spices and herbs. Served alongside a',
              partial: true
            }
          ]},

          { name: 'Dessert', items: [
            {
              name: 'Lychee Lime Raspberry Cake',
              desc: 'Lychee, lime and raspberry cake layered with light pistachio sponge and delicate fruit cream, offering a bright balance of floral',
              partial: true
            },
            {
              name: 'Chendol',
              desc: 'Chendol is made from green-pandan flavoured rice flour jelly, coconut milk, palm sugar syrup, red beans, cream corns, palm',
              partial: true
            },
            {
              name: 'Artisanal Cheese Selection',
              desc: 'Davidstow Crackler Cheddar, St Paulin Cheese, Shropshire Blue with accompaniments and crackers'
            },
            {
              name: 'Selection of Sliced Fresh Fruits',
              desc: ''
            }
          ]},

          { name: 'From The Bakery', items: [
            {
              name: 'Assorted Bread Rolls and Gourmet Breads',
              desc: ''
            }
          ]}

        ]
      }

      // Delectables and Light Dinner go here, in exactly this shape.

    ]
  },

  {
    id: 'drinks',
    name: 'Beverages',
    sub: 'Names, what is in them, how to say them',
    taste: 'Heidsieck · Cairanne · Courvoisier',
    speech: true,
    groups: [

      {
        id: 'wine',
        name: 'Champagne and Wine',
        sub: 'The hardest names on the cart',
        note: 'Please check which of the above wines is available on this flight',
        sections: [

          { name: 'Champagne', items: [
            {
              name: 'Charles Heidsieck Brut Reserve, Champagne, France',
              say: 'SHARL HIDE-seek · broot ray-ZAIRV',
              speak: 'Charles Heidsieck Brut Réserve',
              lang: 'fr-FR',
              desc: 'Champagne, located in the north of France, with its cool climate and famed chalky soil, makes the most famous sparkling wines in',
              partial: true
            }
          ]},

          { name: 'White', items: [
            {
              name: '2025 Lawson’s Dry Hills Reserve Sauvignon Blanc, Marlborough, New Zealand',
              say: 'SOH-vin-yon BLAHN · MARL-bruh',
              desc: 'Lawson’s Dry Hills is a well-known producer from Marlborough, the region that helped make New Zealand Sauvignon Blanc famo',
              partial: true
            },
            {
              name: '2025 Deep Woods Hillside Chardonnay, Margaret River, Australia',
              say: 'SHAR-duh-nay',
              desc: 'Pale in colour, subtle stone fruit aromatics combined with good acidity and fresh vibrant flavours. The Margaret River is the',
              partial: true
            }
          ]},

          { name: 'Red', items: [
            {
              name: '2020 / 2022 Château Pey La Tour Réserve, Bordeaux',
              say: 'sha-TOH pay la TOOR ray-ZAIRV · bor-DOH',
              speak: 'Château Pey La Tour Réserve, Bordeaux',
              lang: 'fr-FR',
              desc: 'Speeding along the autoroute from Bordeaux city to Saint-Émilion, the landscape doesn’t look promising. But the',
              partial: true
            },
            {
              name: '2024 Cairanne “La Porte d’Autanne”, Rhonéa',
              say: 'keh-RAN · la PORT doh-TAN · roh-NAY-ah',
              speak: 'Cairanne, La Porte d’Autanne, Rhonéa',
              lang: 'fr-FR',
              desc: 'With climate change creating ever-warmer conditions in Europe’s vineyards, the most successful are those which have a secret',
              partial: true
            },
            {
              name: '2023 Victor Berard Lirac, Rhone, France',
              say: 'veek-TOR bay-RAR · lee-RAK · ROHN',
              speak: 'Victor Bérard, Lirac, Rhône',
              lang: 'fr-FR',
              desc: 'This Lirac reflects the sunny Mediterranean climate and mineral-rich soils of the right bank of the Rhône, combining power,',
              partial: true
            }
          ]},

          { name: 'Fortified Wine', items: [
            {
              name: 'Kopke 10 years',
              say: 'KOP-kuh',
              desc: 'Making great tawny port is a time-consuming',
              partial: true
            }
          ]}

        ]
      },

      {
        id: 'cocktails',
        name: 'Cocktails and Apéritifs',
        sub: 'Ten cocktails, and what goes in them',
        note: 'Please accept our apologies if your choice is unavailable',
        sections: [

          { name: 'Cocktails', items: [
            {
              name: 'Singapore Sling',
              say: 'Bénédictine = ben-uh-DIK-teen',
              desc: 'Enjoy this 1915 classic and a must-have in Singapore. A concoction of dry gin, Dom Bénédictine, orange liqueur, cherry brandy,',
              partial: true
            },
            {
              name: 'House Sling',
              desc: 'One of our special touches made with gin, orange liqueur, orange juice and pineapple juice, topped with Champagne.'
            },
            {
              name: 'Cuba Libre',
              say: 'KOO-buh LEE-bray',
              desc: 'An iconic concoction of rum and coke.'
            },
            {
              name: 'Screwdriver',
              desc: 'A classic concoction of vodka and orange juice.'
            },
            {
              name: 'Grand Pineapple Daiquiri',
              say: 'DYE-kuh-ree',
              desc: 'A refreshing blend of rum, orange liqueur, topped with pineapple juice.'
            },
            {
              name: 'Alspritzer',
              say: 'AL-sprit-ser',
              desc: 'A sparkling mix of vodka shaken with apple juice and 7-Up.'
            },
            {
              name: 'Jubilee Lining',
              say: 'JOO-bih-lee',
              desc: 'A zesty cocktail created with orange liqueur, vodka, pineapple juice, topped with soda.'
            },
            {
              name: 'Rumba',
              say: 'RUUM-bah',
              desc: 'An exotic thirst quencher of rum mixed with pineapple juice and 7-Up.'
            },
            {
              name: 'Bloody Mary',
              say: 'Worcestershire = WUUS-ter-sher',
              desc: 'A classic blend of vodka, tomato juice, lemon juice with a dash of Worcestershire and Tabasco sauce.'
            },
            {
              name: 'Bellini',
              say: 'beh-LEE-nee · Moscato = mos-KAH-toh',
              desc: 'A refreshing and sweet cocktail made from Moscato and fresh peach juice. Only available prior to take-off.'
            }
          ]},

          { name: 'Apéritif', say: 'ah-pair-ih-TEEF', items: [
            {
              name: 'Campari',
              say: 'kam-PAH-ree',
              desc: ''
            }
          ]}

        ]
      },

      {
        id: 'spirits',
        name: 'Spirits and Beer',
        sub: 'Names only — the menu gives no descriptions',
        note: 'Please accept our apologies if your choice is unavailable',
        sections: [

          { name: 'Spirits', items: [
            {
              name: 'Courvoisier XO Cognac',
              say: 'koor-VWAH-zee-ay · KON-yak',
              speak: 'Courvoisier',
              lang: 'fr-FR',
              desc: ''
            },
            {
              name: 'Ardbeg 10 Year Old Single Malt Islay Scotch Whisky',
              say: 'ARD-beg · Islay = EYE-luh',
              desc: ''
            },
            { name: 'Johnnie Walker Black Label Whisky', desc: '' },
            { name: 'Jack Daniel’s Tennessee Whiskey', desc: '' },
            {
              name: 'Tanqueray Gin',
              say: 'TAN-kuh-ray',
              desc: ''
            },
            { name: 'Alexander Vodka', desc: '' },
            {
              name: 'Bacardi Carta Blanc Superior White Rum',
              say: 'bah-KAR-dee KAR-tah BLAHNK',
              desc: ''
            }
          ]},

          { name: 'Liqueurs', say: 'li-KYOORS', items: [
            { name: 'Baileys Original Irish Cream', desc: '' },
            {
              name: 'Cointreau Orange Liqueur',
              say: 'KWAN-troh',
              speak: 'Cointreau',
              lang: 'fr-FR',
              desc: ''
            }
          ]},

          { name: 'Beer', items: [
            { name: 'Tiger', desc: '' },
            { name: 'Heineken', say: 'HIGH-nuh-ken', desc: '' }
          ]}

        ]
      },

      {
        id: 'soft',
        name: 'Non-Alcoholic',
        sub: 'Mocktails, water and juice',
        sections: [

          { name: 'Mocktails', items: [
            {
              name: 'Midsummer Breeze',
              desc: 'An invigorating concoction of apple, orange and pineapple juices, topped with Sprite for that extra zest.'
            },
            {
              name: 'Royal Sparkle',
              desc: 'A sweet mix of apple juice with ginger ale and soda.'
            },
            {
              name: 'Apple Bliss',
              desc: 'A tantalising refreshment of apple juice and lemon lime mixed with Sprite.'
            },
            {
              name: 'Citrus Delight',
              desc: 'A thirst-quenching blend of orange juice and tonic water.'
            }
          ]},

          { name: 'Mineral Water', items: [
            { name: 'Sparkling', desc: '' },
            { name: 'Still', desc: '' }
          ]},

          { name: 'Fruit Juice', items: [
            { name: 'Apple', desc: '' },
            { name: 'Orange', desc: '' },
            { name: 'Pineapple', desc: '' }
          ]}

        ]
      }

    ]
  }

];

var MENU_FLIGHT = 'Lunch and drinks';
