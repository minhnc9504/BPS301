# Phát hành và rollback

[← Về README](../README.md)

## Kiểm tra trước phát hành

```bash
npm ci
npm run check:release
npm run preview
```

Dev chạy ở `/`. Bản preview và bản tĩnh trên GitHub Pages dùng `/BPS301/`. Mở deep link, F5, kiểm tra logo, một câu ôn và một PDF. Trước khi phát hành, lưu SHA đang phục vụ và xác nhận quyền phân phối kèm rà soát nội dung trong PDF. Các tệp dưới `public/` được đưa vào artifact.

## GitHub Actions

| Workflow | Vai trò |
| --- | --- |
| [Validate BPMS release candidate](../.github/workflows/release-check.yml) | Kiểm tra khi push, mở pull request hoặc chạy thủ công. |
| [Publish approved BPMS build to GitHub Pages](../.github/workflows/pages.yml) | Build và triển khai sau khi chạy thủ công ở `main` và xác nhận quyền công khai tài liệu. |
| [Publish a public BPS301 exam](../.github/workflows/publish-exam.yml) | Kiểm tra đề, cập nhật JSON và danh mục cùng commit khi người có quyền chạy thủ công. Phát hành Pages là thao tác riêng. |

## Trình tự deploy và rollback

1. Dùng PR để review và duyệt SHA cần phát hành. Xác nhận CI xanh, **Settings → Pages → Source** dùng **GitHub Actions**, và áp dụng bảo vệ môi trường `github-pages` theo quyền của dự án.
2. Sau khi có phê duyệt công khai, chạy workflow Pages trên `main`, nhập SHA đã duyệt trong `source_sha` và bật `materials_approved`. Thử URL công khai, tải lại trang con, xem slide đúng trang và xác nhận trạng thái từ hồ sơ thử nghiệm.
3. Nếu cần rollback, phát hành lại SHA ổn định đã duyệt tương thích với quy trình build. Với commit cũ có trước script RC, đưa phần mã cần hoàn nguyên qua PR và giữ lại CI cùng cổng phê duyệt. Giữ origin và đường dẫn để trình duyệt tiếp tục đọc dữ liệu đã lưu. Chờ cache hết hạn nếu một số tài nguyên ở hosting còn cũ.

Xem [báo cáo Phase 7](../PHASE7-RELEASE-REPORT.md) để đối chiếu dữ liệu, SHA nền, phép đo và điều kiện còn chờ duyệt.
