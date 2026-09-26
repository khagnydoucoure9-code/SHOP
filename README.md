# SHOP — Catalogue streetwear / running

SHOP est une boutique catalogue statique, sans panier et sans paiement. Les commandes se font uniquement en privé sur Snapchat. Le frontend fonctionne sur GitHub Pages et utilise Supabase pour l'authentification, la base de données, les images et le temps réel.

## 1. Créer le projet Supabase

1. Créez un projet sur Supabase.
2. Ouvrez **SQL Editor**.
3. Collez le contenu de `shop.sql`.
4. Exécutez-le.

Le SQL crée :
- `products`
- `product_sizes`
- `categories`
- `admin_users`
- les politiques RLS
- le bucket Storage `product-images`
- les publications Realtime.

## 2. Créer le compte administrateur

1. Dans Supabase : **Authentication > Users > Add user**.
2. Créez l'email et le mot de passe du vendeur.
3. Copiez l'UUID de cet utilisateur.
4. Dans SQL Editor, exécutez :

```sql
insert into public.admin_users(user_id)
values ('UUID_DU_COMPTE_AUTH');
```

Seuls les UUID présents dans `admin_users` peuvent utiliser l'administration.

## 3. Configurer les clés

Ouvrez `js/config.js` :

```js
export const SUPABASE_URL = "https://VOTRE-PROJET.supabase.co";
export const SUPABASE_ANON_KEY = "VOTRE_CLE_PUBLIQUE_SUPABASE";
export const SNAP_USERNAME = "@TONSNAP";
```

Dans Supabase, les informations frontend se trouvent généralement dans **Project Settings > API**.

### Ce qui peut être publié

La clé **anon / publishable** est conçue pour être utilisée dans le navigateur. Elle peut apparaître dans GitHub Pages.

### Ce qui ne doit JAMAIS être publié

Ne mettez jamais :
- `service_role`
- une clé `secret`
- un mot de passe Supabase
- un token privé
- des identifiants personnels

dans `config.js`, GitHub ou le navigateur.

La sécurité repose sur Supabase Auth + RLS. Une clé publique n'autorise pas automatiquement les écritures : les policies SQL les limitent aux utilisateurs présents dans `admin_users`.

## 4. Images

Le bucket `product-images` est public afin que les images soient visibles sans connexion.

L'upload, la modification et la suppression sont protégés par RLS : seuls les administrateurs autorisés peuvent écrire.

Les formats acceptés par l'interface sont :
- JPG
- JPEG
- PNG
- WEBP

## 5. Snapchat

Dans `js/config.js`, remplacez :

```js
export const SNAP_USERNAME = "@TONSNAP";
```

par votre vrai pseudo.

Remplacez ensuite `assets/qr-snap.png` par votre vrai QR code Snapchat, en gardant exactement ce nom de fichier.

## 6. Lancer localement

Le projet est statique. Pour éviter les restrictions de modules ES en ouvrant directement `index.html` avec `file://`, utilisez un petit serveur local, par exemple l'extension Live Server de votre éditeur.

Aucun serveur Node.js n'est nécessaire en production.

## 7. GitHub Pages

1. Créez un dépôt GitHub.
2. Envoyez tous les fichiers du dossier.
3. Dans **Settings > Pages**, choisissez le déploiement depuis la branche principale et le dossier `/root`.
4. Enregistrez.
5. Ouvrez l'URL GitHub Pages fournie par GitHub.

La boutique publique n'utilise pas de serveur Node.js : elle charge directement Supabase depuis le navigateur.

## 8. Administration

Ouvrez :

`/admin/`

Connectez-vous avec le compte Auth ajouté dans `admin_users`.

Depuis le téléphone, vous pouvez :
- ajouter/modifier/supprimer un produit
- importer une image
- modifier le prix
- modifier la description
- modifier la catégorie
- activer/désactiver le produit
- activer « Nouveau »
- activer « Produit mis en avant »
- modifier les stocks S/M/L/XL/XXL
- créer et renommer des catégories
- rechercher et filtrer les produits
- filtrer les ruptures et les produits en stock

Les changements de `products`, `product_sizes` et `categories` sont diffusés via Supabase Realtime. La boutique publique recharge automatiquement les données lorsqu'un changement est détecté.

## 9. Prix

Le symbole affiché sur le site est volontairement `🎾`. Le caractère `€` n'est pas utilisé dans l'interface.

## 10. Commandes

Il n'existe volontairement :
- aucun panier
- aucun checkout
- aucun paiement
- aucun Stripe
- aucun PayPal
- aucun bouton « Ajouter au panier »

Le client consulte uniquement le catalogue puis contacte le vendeur sur Snapchat.

## 11. Règles RLS

Le public peut lire uniquement :
- les catégories actives
- les produits actifs
- les tailles des produits actifs

Un visiteur non connecté ne peut pas :
- ajouter un produit
- modifier un produit
- supprimer un produit
- modifier le stock
- modifier les catégories

Les écritures nécessitent un utilisateur Auth dont l'UUID est présent dans `admin_users`.

## 12. Important avant mise en ligne

- Remplacez les valeurs `VOTRE-PROJET` et `VOTRE_CLE_PUBLIQUE_SUPABASE`.
- Remplacez `@TONSNAP`.
- Remplacez le QR code.
- Vérifiez les policies RLS dans Supabase.
- Testez `/admin/` avec un compte non administrateur : l'accès doit être refusé.
- Testez la boutique en navigation privée.
