import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Modal } from "./Modal";
import { Input } from "./FormField";

const ModalWithInlineClose = () => {
  const [value, setValue] = useState("");

  return (
    <Modal
      open
      title="Nhập dữ liệu"
      onClose={() => undefined}
      confirmLabel="Lưu"
      onConfirm={() => undefined}
    >
      <Input label="Nội dung" value={value} onChange={(event) => setValue(event.target.value)} />
    </Modal>
  );
};

describe("Modal", () => {
  it("giữ focus trong input khi parent render lại vì nhập liệu", async () => {
    const user = userEvent.setup();
    render(<ModalWithInlineClose />);

    const input = screen.getByLabelText("Nội dung");
    await user.type(input, "gmail@example.com");

    expect(input).toHaveValue("gmail@example.com");
    expect(input).toHaveFocus();
  });
});
