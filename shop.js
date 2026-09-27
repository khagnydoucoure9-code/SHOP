import {
SUPABASE_URL,
SUPABASE_ANON_KEY,
SNAP_USERNAME,
STORAGE_BUCKET
} from "./config.js";

const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let products = [];
let categories = [];
let selectedCategory = "Tous";
let searchTerm = "";

const $ = (selector) => document.querySelector(selector);

function esc(value = "") {
return String(value).replace(/[&<>"']/g, (char) => {
const map = {
"&": "&",
"<": "<",
">": ">",
'"': """,
"'": "'"
};

```
return map[char];
```

});
}

function imageUrl(path) {
if (!path) return "";

if (path.startsWith("http")) {
return path;
}

return db.storage
.from(STORAGE_BUCKET)
.getPublicUrl(path).data.publicUrl;
}

function productSizes(product) {
const order = ["S", "M", "L", "XL", "XXL"];

return (product.product_sizes || [])
.filter((size) => size.enabled)
.sort(
(a, b) =>
order.indexOf(a.size) - order.indexOf(b.size)
);
}

function matches(product) {
const text = [
product.name,
product.description,
product.categories?.name
]
.join(" ")
.toLowerCase();

const categoryMatch =
selectedCategory === "Tous" ||
product.categories?.name === selectedCategory;

return categoryMatch && text.includes(searchTerm);
}

/* =========================
CARTE PRODUIT
========================= */

function card(product) {
const sizes = productSizes(product);

const available = sizes.filter(
(size) => Number(size.quantity) > 0
).length;

return ` <article class="product-card" data-id="${esc(product.id)}">

```
  <div class="product-image">

    ${
      product.image_path
        ? `
          <img
            src="${esc(imageUrl(product.image_path))}"
            alt="${esc(product.name)}"
            loading="lazy"
          >
        `
        : ""
    }

    ${
      product.is_new
        ? `<span class="tag">Nouveau</span>`
        : ""
    }

  </div>

  <div class="product-info">

    <p class="product-name">
      ${esc(product.name)}
    </p>

    <div class="product-price">
      ${Number(product.price).toLocaleString("fr-FR")} 🎾
    </div>

    <div class="product-meta">
      ${
        available > 0
          ? `${available} taille${available > 1 ? "s" : ""} disponible${available > 1 ? "s" : ""}`
          : "Rupture de stock"
      }
    </div>

  </div>

</article>
```

`;
}

/* =========================
GRILLES
========================= */

function renderGrid(selector, list) {
const element = $(selector);

if (!element) return;

element.innerHTML = list.length
? list.map(card).join("")
: "";

element
.querySelectorAll(".product-card")
.forEach((item) => {
item.addEventListener("click", () => {
openProduct(item.dataset.id);
});
});
}

function render() {
const filtered = products.filter(matches);

renderGrid("#productGrid", filtered);

const emptyState = $("#emptyState");

if (emptyState) {
emptyState.classList.toggle(
"hidden",
filtered.length > 0
);
}

renderGrid(
"#newGrid",
products.filter((product) => product.is_new)
);

renderGrid(
"#featuredGrid",
products.filter((product) => product.is_featured)
);
}

/* =========================
CATEGORIES
========================= */

function renderCategories() {
const categoryFilters = $("#categoryFilters");
const categoryCards = $("#categoryCards");

const names = [
"Tous",
...categories.map((category) => category.name)
];

if (categoryFilters) {
categoryFilters.innerHTML = names
.map(
(name) => `           <button
            type="button"
            class="filter-btn ${
              name === selectedCategory ? "active" : ""
            }"
            data-cat="${esc(name)}"           >
            ${esc(name)}           </button>
        `
)
.join("");

```
categoryFilters
  .querySelectorAll("[data-cat]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      selectedCategory = button.dataset.cat;

      renderCategories();
      render();
    });
  });
```

}

if (categoryCards) {
categoryCards.innerHTML = categories
.map(
(category) => `           <a
            class="category-card"
            href="#products"
            data-cat-card="${esc(category.name)}"           >
            ${esc(category.name)}           </a>
        `
)
.join("");

```
categoryCards
  .querySelectorAll("[data-cat-card]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      selectedCategory =
        button.dataset.catCard;

      renderCategories();
      render();
    });
  });
```

}
}

/* =========================
CHARGEMENT
========================= */

async function load() {
try {
const categoriesResult = await db
.from("categories")
.select("*")
.eq("active", true)
.order("sort_order");

```
const productsResult = await db
  .from("products")
  .select(
    "*, categories(name), product_sizes(*)"
  )
  .eq("active", true)
  .order("created_at", {
    ascending: false
  });

/*
  IMPORTANT :
  Les images supplémentaires sont chargées
  séparément afin qu'une erreur de product_images
  ne bloque pas l'affichage des produits.
*/

let imageRows = [];

const imagesResult = await db
  .from("product_images")
  .select("*")
  .order("sort_order", {
    ascending: true
  });

if (!imagesResult.error) {
  imageRows = imagesResult.data || [];
} else {
  console.warn(
    "Impossible de charger les images supplémentaires :",
    imagesResult.error
  );
}

if (
  categoriesResult.error ||
  productsResult.error
) {
  console.error(
    categoriesResult.error ||
    productsResult.error
  );

  const grid = $("#productGrid");

  if (grid) {
    grid.innerHTML = `
      <div class="loading-state">
        Impossible de charger les produits.
      </div>
    `;
  }

  return;
}

categories =
  categoriesResult.data || [];

products =
  (productsResult.data || []).map(
    (product) => ({
      ...product,

      gallery: imageRows
        .filter(
          (image) =>
            image.product_id === product.id
        )
        .sort(
          (a, b) =>
            Number(a.sort_order || 0) -
            Number(b.sort_order || 0)
        )
    })
  );

renderCategories();
render();

document
  .querySelector(".loading-state")
  ?.remove();
```

} catch (error) {
console.error(
"Erreur chargement SHOP :",
error
);
}
}

/* =========================
PRODUIT / GALERIE
========================= */

function openProduct(id) {
const product = products.find(
(item) => item.id === id
);

if (!product) return;

const gallery = [];

/*
L'ancienne image principale reste compatible.
*/

if (product.image_path) {
gallery.push({
image_path: product.image_path
});
}

/*
Ajout des nouvelles images.
Les doublons sont ignorés.
*/

for (const image of product.gallery || []) {
if (!image.image_path) continue;

```
const alreadyExists = gallery.some(
  (item) =>
    item.image_path === image.image_path
);

if (!alreadyExists) {
  gallery.push(image);
}
```

}

const firstImage =
gallery.length > 0
? imageUrl(gallery[0].image_path)
: "";

const dialogContent =
$("#dialogContent");

if (!dialogContent) return;

dialogContent.innerHTML = ` <div class="dialog-product">

```
  <div class="product-gallery">

    <div class="gallery-main">

      ${
        firstImage
          ? `
            <img
              id="galleryMainImage"
              src="${esc(firstImage)}"
              alt="${esc(product.name)}"
            >
          `
          : `
            <div class="gallery-empty">
              Pas d'image
            </div>
          `
      }

    </div>

    ${
      gallery.length > 1
        ? `
          <div class="gallery-thumbs">

            ${gallery
              .map(
                (image, index) => `
                  <button
                    type="button"
                    class="gallery-thumb ${
                      index === 0
                        ? "active"
                        : ""
                    }"
                    data-gallery-index="${index}"
                  >
                    <img
                      src="${esc(
                        imageUrl(
                          image.image_path
                        )
                      )}"
                      alt="${esc(
                        product.name
                      )}"
                    >
                  </button>
                `
              )
              .join("")}

          </div>
        `
        : ""
    }

  </div>

  <div class="dialog-copy">

    ${
      product.is_new
        ? `<p class="eyebrow">NOUVEAU</p>`
        : ""
    }

    <h2>
      ${esc(product.name)}
    </h2>

    <div class="dialog-price">
      ${Number(product.price).toLocaleString(
        "fr-FR"
      )} 🎾
    </div>

    <p class="dialog-desc">
      ${esc(product.description || "")}
    </p>

    <div class="sizes">

      ${productSizes(product)
        .map(
          (size) => `
            <div class="size-row">

              <strong>
                ${esc(size.size)}
              </strong>

              <span
                class="${
                  Number(size.quantity) > 0
                    ? "available"
                    : "soldout"
                }"
              >
                ${
                  Number(size.quantity) > 0
                    ? `${Number(
                        size.quantity
                      )} disponible${
                        Number(size.quantity) > 1
                          ? "s"
                          : ""
                      }`
                    : "Rupture"
                }
              </span>

            </div>
          `
        )
        .join("")}

    </div>

    <div class="order-note">
      Pour commander :
      contacte-moi directement sur Snapchat —
      ${esc(SNAP_USERNAME)}
    </div>

  </div>

</div>
```

`;

const mainImage =
$("#galleryMainImage");

dialogContent
.querySelectorAll(".gallery-thumb")
.forEach((button) => {
button.addEventListener("click", () => {
const index = Number(
button.dataset.galleryIndex
);

```
    if (!gallery[index] || !mainImage) {
      return;
    }

    mainImage.src = imageUrl(
      gallery[index].image_path
    );

    dialogContent
      .querySelectorAll(".gallery-thumb")
      .forEach((item) => {
        item.classList.remove("active");
      });

    button.classList.add("active");
  });
});
```

const dialog = $("#productDialog");

if (dialog) {
dialog.showModal();
}
}

/* =========================
RECHERCHE
========================= */

const searchInput =
$("#searchInput");

if (searchInput) {
searchInput.addEventListener(
"input",
(event) => {
searchTerm = event.target.value
.trim()
.toLowerCase();

```
  render();
}
```

);
}

const searchTrigger =
$("#searchTrigger");

if (searchTrigger) {
searchTrigger.addEventListener(
"click",
() => {
if (searchInput) {
searchInput.focus();
}

```
  location.hash = "products";
}
```

);
}

/* =========================
FERMETURE DIALOG
========================= */

const dialogClose =
$("#dialogClose");

if (dialogClose) {
dialogClose.addEventListener(
"click",
() => {
$("#productDialog")?.close();
}
);
}

/* =========================
MENU MOBILE
========================= */

const menuToggle =
document.querySelector(
".menu-toggle"
);

const mainNav =
document.querySelector(
".main-nav"
);

if (menuToggle && mainNav) {
menuToggle.addEventListener(
"click",
(event) => {
mainNav.classList.toggle("open");

```
  event.currentTarget.setAttribute(
    "aria-expanded",
    mainNav.classList.contains("open")
  );
}
```

);
}

document
.querySelectorAll(".main-nav a")
.forEach((link) => {
link.addEventListener("click", () => {
mainNav?.classList.remove("open");
});
});

const snapHandle =
document.querySelector(
".snap-handle"
);

if (snapHandle) {
snapHandle.textContent =
SNAP_USERNAME;
}

/* =========================
REALTIME
========================= */

db.channel("shop-live")

.on(
"postgres_changes",
{
event: "*",
schema: "public",
table: "products"
},
load
)

.on(
"postgres_changes",
{
event: "*",
schema: "public",
table: "product_sizes"
},
load
)

.on(
"postgres_changes",
{
event: "*",
schema: "public",
table: "categories"
},
load
)

.on(
"postgres_changes",
{
event: "*",
schema: "public",
table: "product_images"
},
load
)

.subscribe();

/* =========================
START
========================= */

load();
