import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  STORAGE_BUCKET
} from "./config.js";

const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const sizes = ["S", "M", "L", "XL", "XXL"];

let products = [];
let categories = [];

const $ = (selector) => document.querySelector(selector);

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return map[char];
  });
}

function toast(message) {
  const element = $("#toast");

  if (!element) {
    return;
  }

  element.textContent = message;
  element.style.display = "block";

  setTimeout(() => {
    element.style.display = "none";
  }, 2200);
}

async function isAdmin() {
  const {
    data: { user }
  } = await db.auth.getUser();

  if (!user) {
    return false;
  }

  const { data, error } = await db
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return !error && !!data;
}

async function start() {
  const {
    data: { session }
  } = await db.auth.getSession();

  if (session && await isAdmin()) {
    showAdmin(session.user);
  } else {
    showLogin();
  }
}

function showLogin() {
  $("#loginView").hidden = false;
  $("#adminView").hidden = true;
}

function showAdmin(user) {
  $("#loginView").hidden = true;
  $("#adminView").hidden = false;
  $("#adminEmail").textContent = user.email || "";

  loadAll();
}

async function loadAll() {
  const categoriesResult = await db
    .from("categories")
    .select("*")
    .order("sort_order");

  const productsResult = await db
    .from("products")
    .select("*, categories(name), product_sizes(*), product_images(*)")
    .order("created_at", {
      ascending: false
    });

  if (categoriesResult.error || productsResult.error) {
    console.error(
      categoriesResult.error || productsResult.error
    );

    toast("Erreur de chargement");
    return;
  }

  categories = categoriesResult.data || [];
  products = productsResult.data || [];

  render();
}

function totalStock(product) {
  return (product.product_sizes || [])
    .filter((size) => size.enabled)
    .reduce(
      (total, size) => total + Number(size.quantity || 0),
      0
    );
}

function render() {
  $("#statProducts").textContent =
    products.filter((product) => product.active).length;

  $("#statStock").textContent =
    products.reduce(
      (total, product) => total + totalStock(product),
      0
    );

  $("#statOut").textContent =
    products.filter(
      (product) => totalStock(product) === 0
    ).length;

  $("#statNew").textContent =
    products.filter((product) => product.is_new).length;

  $("#statFeatured").textContent =
    products.filter((product) => product.is_featured).length;

  $("#adminCategory").innerHTML =
    '<option value="">Toutes les catégories</option>' +
    categories
      .map(
        (category) =>
          `<option value="${esc(category.id)}">${esc(category.name)}</option>`
      )
      .join("");

  $("#pCategory").innerHTML =
    categories
      .map(
        (category) =>
          `<option value="${esc(category.id)}">${esc(category.name)}</option>`
      )
      .join("");

  const search = $("#adminSearch").value
    .trim()
    .toLowerCase();

  const category = $("#adminCategory").value;
  const stock = $("#adminStock").value;

  const filteredProducts = products.filter((product) => {
    const text = [
      product.name,
      product.description,
      product.categories?.name
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch =
      !search || text.includes(search);

    const matchesCategory =
      !category ||
      product.category_id === category;

    const matchesStock =
      !stock ||
      (
        stock === "in"
          ? totalStock(product) > 0
          : totalStock(product) === 0
      );

    return (
      matchesSearch &&
      matchesCategory &&
      matchesStock
    );
  });

  $("#adminProducts").innerHTML =
    filteredProducts
      .map((product) => {
        const imagesCount =
          (product.product_images || []).length;

        return `
          <tr>
            <td>
              <strong>${esc(product.name)}</strong>
              ${
                imagesCount > 0
                  ? `<small style="display:block;color:#777">
                      ${imagesCount} image${imagesCount > 1 ? "s" : ""}
                    </small>`
                  : ""
              }
            </td>

            <td>
              ${Number(product.price).toLocaleString("fr-FR")} 🎾
            </td>

            <td>
              ${esc(product.categories?.name || "—")}
            </td>

            <td>
              <div class="stock-mini">
                ${
                  (product.product_sizes || [])
                    .filter((size) => size.enabled)
                    .map(
                      (size) =>
                        `<span>${esc(size.size)}: ${Number(size.quantity || 0)}</span>`
                    )
                    .join("") || "—"
                }
              </div>
            </td>

            <td>
              ${product.active ? "Actif" : "Masqué"}
              ${product.is_new ? " · Nouveau" : ""}
              ${product.is_featured ? " · ⭐" : ""}
            </td>

            <td>
              <button
                type="button"
                class="admin-btn"
                data-edit="${esc(product.id)}"
              >
                Modifier
              </button>

              <button
                type="button"
                class="admin-btn danger"
                data-del="${esc(product.id)}"
              >
                Supprimer
              </button>
            </td>
          </tr>
        `;
      })
      .join("");

  $("#categoryAdminList").innerHTML =
    categories
      .map(
        (category) => `
          <div
            style="
              display:flex;
              justify-content:space-between;
              align-items:center;
              padding:10px 0;
              border-bottom:1px solid #eee;
            "
          >
            <span>${esc(category.name)}</span>

            <button
              type="button"
              class="admin-btn"
              data-cat-edit="${esc(category.id)}"
            >
              Modifier
            </button>
          </div>
        `
      )
      .join("");

  document
    .querySelectorAll("[data-edit]")
    .forEach((button) => {
      button.onclick = () =>
        openProduct(button.dataset.edit);
    });

  document
    .querySelectorAll("[data-del]")
    .forEach((button) => {
      button.onclick = () =>
        deleteProduct(button.dataset.del);
    });

  document
    .querySelectorAll("[data-cat-edit]")
    .forEach((button) => {
      button.onclick = () =>
        openCategory(button.dataset.catEdit);
    });
}

function resetForm() {
  $("#productId").value = "";
  $("#modalTitle").textContent = "Ajouter un produit";

  $("#pName").value = "";
  $("#pPrice").value = "";
  $("#pDescription").value = "";
  $("#pImage").value = "";
  $("#pActive").checked = true;
  $("#pNew").checked = false;
  $("#pFeatured").checked = false;

  $("#sizeInputs").innerHTML =
    sizes
      .map(
        (size) => `
          <label class="size-admin-item">
            <span>
              <input
                type="checkbox"
                data-enabled="${size}"
              >
              ${size}
            </span>

            <input
              type="number"
              min="0"
              value="0"
              data-qty="${size}"
            >
          </label>
        `
      )
      .join("");
}

function openProduct(id = null) {
  resetForm();

  if (id) {
    const product =
      products.find((item) => item.id === id);

    if (!product) {
      return;
    }

    $("#modalTitle").textContent =
      "Modifier le produit";

    $("#productId").value = product.id;
    $("#pName").value = product.name || "";
    $("#pPrice").value = product.price || "";
    $("#pDescription").value =
      product.description || "";

    $("#pCategory").value =
      product.category_id || "";

    $("#pActive").checked =
      !!product.active;

    $("#pNew").checked =
      !!product.is_new;

    $("#pFeatured").checked =
      !!product.is_featured;

    for (const size of product.product_sizes || []) {
      const enabledInput =
        $(`[data-enabled="${size.size}"]`);

      const quantityInput =
        $(`[data-qty="${size.size}"]`);

      if (enabledInput) {
        enabledInput.checked =
          !!size.enabled;
      }

      if (quantityInput) {
        quantityInput.value =
          Number(size.quantity || 0);
      }
    }
  }

  $("#productModal").showModal();
}

async function uploadImage(file, productId) {
  if (!file) {
    return null;
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error(
      "Format image non accepté. Utilise JPG, PNG ou WEBP."
    );
  }

  const extension =
    file.name.split(".").pop().toLowerCase();

  const path =
    `${productId}/${crypto.randomUUID()}.${extension}`;

  const { error } =
    await db.storage
      .from(STORAGE_BUCKET)
      .upload(
        path,
        file,
        {
          upsert: false,
          contentType: file.type
        }
      );

  if (error) {
    throw error;
  }

  return path;
}

async function saveImages(productId, files) {
  if (!files.length) {
    return [];
  }

  const uploadedImages = [];

  for (let index = 0; index < files.length; index++) {
    const path =
      await uploadImage(
        files[index],
        productId
      );

    uploadedImages.push({
      product_id: productId,
      image_path: path,
      sort_order: index
    });
  }

  const { error } =
    await db
      .from("product_images")
      .insert(uploadedImages);

  if (error) {
    throw error;
  }

  return uploadedImages;
}

$("#productForm").addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    try {
      const existingId =
        $("#productId").value;

      const productId =
        existingId || crypto.randomUUID();

      const payload = {
        id: productId,
        name: $("#pName").value.trim(),
        price: Number($("#pPrice").value),
        description:
          $("#pDescription").value.trim(),
        category_id:
          $("#pCategory").value || null,
        active:
          $("#pActive").checked,
        is_new:
          $("#pNew").checked,
        is_featured:
          $("#pFeatured").checked
      };

      const files =
        Array.from(
          $("#pImage").files || []
        );

      let uploadedImages = [];

      if (files.length > 0) {
        uploadedImages =
          await saveImages(
            productId,
            files
          );

        /*
         * La première image devient
         * également l'image principale
         * du produit.
         */
        payload.image_path =
          uploadedImages[0].image_path;
      }

      let result;

      if (existingId) {
        result =
          await db
            .from("products")
            .update(payload)
            .eq("id", productId);
      } else {
        result =
          await db
            .from("products")
            .insert(payload);
      }

      if (result.error) {
        throw result.error;
      }

      const stockRows =
        sizes.map((size) => ({
          product_id: productId,
          size,
          enabled:
            $(`[data-enabled="${size}"]`)
              .checked,
          quantity:
            Math.max(
              0,
              Number(
                $(`[data-qty="${size}"]`)
                  .value || 0
              )
            )
        }));

      const stockResult =
        await db
          .from("product_sizes")
          .upsert(
            stockRows,
            {
              onConflict:
                "product_id,size"
            }
          );

      if (stockResult.error) {
        throw stockResult.error;
      }

      if (uploadedImages.length > 0) {
        toast(
          `${uploadedImages.length} image${uploadedImages.length > 1 ? "s" : ""} enregistrée${uploadedImages.length > 1 ? "s" : ""}`
        );
      } else {
        toast("Produit enregistré");
      }

      $("#productModal").close();

      await loadAll();

    } catch (error) {
      console.error(error);

      toast(
        error.message ||
        "Erreur lors de l'enregistrement"
      );
    }
  }
);

async function deleteProduct(id) {
  const confirmed =
    confirm(
      "Supprimer définitivement ce produit ?"
    );

  if (!confirmed) {
    return;
  }

  /*
   * On supprime d'abord les lignes
   * de la galerie.
   */
  const imagesResult =
    await db
      .from("product_images")
      .delete()
      .eq("product_id", id);

  if (imagesResult.error) {
    toast(imagesResult.error.message);
    return;
  }

  const { error } =
    await db
      .from("products")
      .delete()
      .eq("id", id);

  if (error) {
    toast(error.message);
    return;
  }

  toast("Produit supprimé");

  await loadAll();
}

$("#addProduct").onclick = () =>
  openProduct();

$("#cancelModal").onclick = () =>
  $("#productModal").close();

$("#adminSearch").oninput = render;
$("#adminCategory").onchange = render;
$("#adminStock").onchange = render;

$("#loginForm").addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    $("#loginError").textContent = "";

    const {
      data,
      error
    } =
      await db.auth.signInWithPassword({
        email: $("#email").value,
        password: $("#password").value
      });

    if (error) {
      $("#loginError").textContent =
        error.message;

      return;
    }

    if (!(await isAdmin())) {
      await db.auth.signOut();

      $("#loginError").textContent =
        "Ce compte n'est pas autorisé à accéder à l'administration.";

      return;
    }

    showAdmin(data.user);
  }
);

$("#logout").onclick =
  async () => {
    await db.auth.signOut();
    showLogin();
  };

$("#createCategory").onclick =
  async () => {
    const name =
      $("#newCategory").value.trim();

    if (!name) {
      return;
    }

    const { error } =
      await db
        .from("categories")
        .insert({
          name,
          sort_order: categories.length
        });

    if (error) {
      toast(error.message);
      return;
    }

    $("#newCategory").value = "";

    toast("Catégorie ajoutée");

    await loadAll();
  };

function openCategory(id) {
  const category =
    categories.find(
      (item) => item.id === id
    );

  if (!category) {
    return;
  }

  $("#categoryId").value =
    category.id;

  $("#categoryName").value =
    category.name;

  $("#categoryModal").showModal();
}

$("#cancelCategory").onclick =
  () => $("#categoryModal").close();

$("#categoryForm").addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    const { error } =
      await db
        .from("categories")
        .update({
          name:
            $("#categoryName")
              .value
              .trim()
        })
        .eq(
          "id",
          $("#categoryId").value
        );

    if (error) {
      toast(error.message);
      return;
    }

    $("#categoryModal").close();

    toast("Catégorie modifiée");

    await loadAll();
  }
);

db.channel("admin-live")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "products"
    },
    loadAll
  )
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "product_sizes"
    },
    loadAll
  )
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "categories"
    },
    loadAll
  )
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "product_images"
    },
    loadAll
  )
  .subscribe();

start();
