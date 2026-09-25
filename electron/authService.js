const https = require("https");
const http = require("http");
const { URL } = require("url");
const { safeStorage } = require("electron");
const { getEndpoints } = require("./endpoints");

function requestJson(url, options, body) {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const req = client.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            const error = new Error(parsed?.message || `Erreur HTTP ${res.statusCode}`);
            // Permet à l'appelant de distinguer une maintenance d'une erreur
            // d'identifiants, les deux arrivant ici comme un statut non-2xx.
            if (parsed?.maintenance) error.maintenance = true;
            reject(error);
          }
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * Gère l'authentification et plusieurs comptes mémorisés.
 *
 * Stockage (electron-store) :
 *  - `accounts`      : tableau des comptes connus (identifiés par email)
 *  - `activeEmail`   : email du compte actuellement sélectionné
 *
 * Chaque compte garde son mot de passe chiffré via safeStorage, ce qui permet
 * de basculer de l'un à l'autre sans ressaisie — et de lancer le jeu avec les
 * bons identifiants.
 */
class AuthService {
  constructor(store) {
    this.store = store;
  }

  _getAccounts() {
    return this.store.get("accounts") || [];
  }

  _setAccounts(accounts) {
    this.store.set("accounts", accounts);
  }

  /** Version sûre pour l'UI : jamais le mot de passe chiffré ni le token. */
  _publicView(account) {
    if (!account) return null;
    const { encryptedPassword, token, ...safe } = account;
    return safe;
  }

  async login({ email, password }) {
    const url = new URL(getEndpoints().login);

    const result = await requestJson(
      url,
      { method: "POST", headers: { "Content-Type": "application/json" } },
      { email, password }
    ).catch((err) => {
      // Le backend renvoie 503 + { maintenance: true } quand le service est
      // fermé : on le distingue d'un vrai échec d'identifiants pour que l'UI
      // affiche l'écran de maintenance et non "mot de passe incorrect".
      if (err.maintenance) throw Object.assign(new Error("MAINTENANCE"), { maintenance: true, message: err.message });
      throw err;
    });

    // result attendu: { token, account: { username, displayName, avatarUrl } }
    const account = { ...result.account, token: result.token, email };

    // Le mot de passe est nécessaire au lancement (AzureAnticheat.exe attend
    // -email=/-mdp=), mais jamais stocké en clair : safeStorage le chiffre
    // avec les identifiants du compte OS (DPAPI/Keychain/libsecret).
    if (safeStorage.isEncryptionAvailable()) {
      account.encryptedPassword = safeStorage.encryptString(password).toString("base64");
    }

    // Un même email ne doit jamais apparaître deux fois dans la liste
    const accounts = this._getAccounts().filter((a) => a.email !== email);
    accounts.push(account);
    this._setAccounts(accounts);
    this.store.set("activeEmail", email);

    return this._publicView(account);
  }

  /** Déconnecte le compte actif et l'oublie complètement (mot de passe inclus). */
  async logout() {
    const activeEmail = this.store.get("activeEmail");
    this._setAccounts(this._getAccounts().filter((a) => a.email !== activeEmail));
    this.store.delete("activeEmail");
    return { success: true };
  }

  /**
   * Bascule sur un autre compte déjà mémorisé. Échoue si le compte n'est pas
   * connu ou si son mot de passe n'est plus déchiffrable — dans ce cas l'UI
   * doit redemander une connexion normale pour cet email.
   */
  async switchAccount(email) {
    const account = this._getAccounts().find((a) => a.email === email);
    if (!account) throw new Error("Compte inconnu.");

    this.store.set("activeEmail", email);
    return this._publicView(account);
  }

  /** Oublie un compte mémorisé (sans forcément être celui qui est actif). */
  async removeAccount(email) {
    this._setAccounts(this._getAccounts().filter((a) => a.email !== email));
    if (this.store.get("activeEmail") === email) {
      this.store.delete("activeEmail");
    }
    return { success: true };
  }

  getStoredAccount() {
    const activeEmail = this.store.get("activeEmail");
    if (!activeEmail) return null;
    return this._publicView(this._getAccounts().find((a) => a.email === activeEmail));
  }

  /** Liste des comptes mémorisés, pour le sélecteur de compte. */
  listAccounts() {
    const activeEmail = this.store.get("activeEmail");
    return this._getAccounts().map((a) => ({
      ...this._publicView(a),
      isActive: a.email === activeEmail,
    }));
  }

  /**
   * Renvoie { email, password } déchiffrés, prêts pour les arguments de
   * lancement — ou null si personne n'est connecté / déchiffrement impossible
   * (autre machine, chiffrement OS indisponible…), auquel cas l'appelant doit
   * redemander une connexion.
   */
  getLaunchCredentials() {
    const activeEmail = this.store.get("activeEmail");
    const account = this._getAccounts().find((a) => a.email === activeEmail);
    if (!account?.email || !account?.encryptedPassword) return null;

    try {
      const password = safeStorage.decryptString(Buffer.from(account.encryptedPassword, "base64"));
      return { email: account.email, password };
    } catch {
      return null;
    }
  }
}

module.exports = { AuthService };
