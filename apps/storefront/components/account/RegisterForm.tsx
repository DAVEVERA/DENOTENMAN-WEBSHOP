import { Icon } from "../ui/Icon";

export function RegisterForm() {
  return (
    <form className="auth-form">
      <label>
        Naam
        <input type="text" name="name" autoComplete="name" />
      </label>

      <label>
        E-mailadres
        <input type="email" name="email" autoComplete="email" />
      </label>

      <label>
        Wachtwoord
        <input type="password" name="password" autoComplete="new-password" />
      </label>

      <button className="button button--primary" type="submit">
        <Icon name="portrait" />
        Account aanmaken
      </button>
    </form>
  );
}
