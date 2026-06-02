import { Icon } from "../ui/Icon";

export function CouponForm() {
  return (
    <form className="auth-form">
      <label>
        Kortingscode
        <input type="text" name="coupon" placeholder="Vul kortingscode in" />
      </label>

      <button className="button button--secondary" type="submit">
        <Icon name="discount" />
        Toepassen
      </button>
    </form>
  );
}
