import { Icon } from "../ui/Icon";

export function LoginForm() {
  return (
    <form className="auth-form">
      <label>
        E-mailadres
        <input type="email" name="email" autoComplete="email" />
      </label>

      <label>
        Wachtwoord
        <input type="password" name="password" autoComplete="current-password" />
      </label>

      <button className="button button--primary" type="submit">
        <Icon name="portrait" />
        Inloggen
      </button>
    </form>
  );
}
