# BPMS Phase 7 · Release Candidate

**Phiên bản:** `1.0.0-rc.1`  
**Kết luận kỹ thuật:** **READY FOR STAGING** trên môi trường kiểm thử cục bộ hoặc có kiểm soát truy cập.  
**Cổng phát hành công khai:** chờ chủ dự án xác nhận quyền phân phối, rà soát dữ liệu và duyệt lần phát hành. Không có Git push, GitHub release hay Pages deployment được thực hiện trong đợt này.

## 1. Phạm vi Release Candidate

Bản này gồm Tổng quan, Giáo trình theo Lecture, xem slide PDF, Ôn tập và Spaced Repetition, Thi thử có phân tích, Ngân hàng câu hỏi và Sao lưu/Khôi phục. Phase 5 được xác nhận qua mã nguồn và luồng thi thử. Phase 6 được xác nhận qua báo cáo, mã khóa ghi và kiểm thử nhiều tab. Các tính năng học tập và dữ liệu hiện hữu được giữ nguyên.

Thay đổi của Phase 7 tập trung vào kiểm tra tự động, cổng phát hành thủ công và thông báo chỉ đọc khi thiếu Web Locks. Trình nhập tài liệu kiểm tra yêu cầu này trước khi ghi IndexedDB.

## 2. Build, kiểm tra dữ liệu và quy tắc CI

`npm run check:release` thành công trên Node.js 24. Lệnh chạy TypeScript, Vite build, 20/20 unit test và kiểm tra thư mục `dist`. Bộ kiểm tra đọc schema câu hỏi bằng parser của ứng dụng, kiểm tra ID duy nhất, khớp nguồn PDF giữa theory và manifest, đọc PDF thật để đếm trang, đối chiếu tham chiếu, chạy kịch bản chuyển tiếp deep link và kiểm tra base/asset. Giới hạn dành cho JS khởi tạo là 145.000 byte gzip. Bản RC đạt 128.409 byte.

| Hạng mục | Thực tế |
| --- | ---: |
| Bộ đề | 6 |
| Câu hỏi | 310 |
| Lecture | 11 |
| Mục chính | 48 |
| Mục bổ sung | 32 |
| PDF | 11 |
| Trang | 485 |
| Tham chiếu slide của các mục | 343 |

Workflow **Validate BPMS release candidate** chạy kiểm tra trên push, pull request và thủ công, với quyền đọc. Workflow Pages chỉ nhận yêu cầu thủ công từ `main`, cần bật `materials_approved` và kiểm tra SHA đã review thuộc lịch sử `main`. Workflow đăng đề tiếp tục nhận yêu cầu thủ công và kiểm tra dữ liệu trước khi cập nhật repository. Bước gọi deploy đã được bỏ khỏi workflow đăng đề. Chưa chạy CI trên GitHub vì thay đổi chưa được push.

## 3. E2E và tương thích trình duyệt

| Trình duyệt | Kết quả |
| --- | --- |
| Chrome 157.0.8103.79 | Đạt kịch bản Web Locks, nhiều tab, trình duyệt mở lại và cập nhật cùng origin trên HTTP loopback và HTTPS thử nghiệm. |
| Edge 158.0.4370.33 | Đạt cùng bộ kiểm tra Web Locks, backup, responsive và cập nhật cùng origin. |
| Firefox | Không tìm thấy bản cài trong môi trường kiểm thử. |
| Safari | Không có bản Safari để chạy trên môi trường Windows này. |

HTTPS thử nghiệm dùng chứng chỉ cục bộ và hồ sơ QA chấp nhận chứng chỉ đó. Phép thử thiếu Web Locks vô hiệu hóa API trong hồ sơ sạch, kiểm tra thông báo tiếng Việt và xác nhận thao tác không tạo dữ liệu trong localStorage hoặc IndexedDB. Hồ sơ này vẫn đọc học liệu được. Kiểm thử nhiều tab ghi hai lựa chọn độc lập, đánh dấu khó, cập nhật Giáo trình và nộp cùng phiên. Kết quả giữ một bản ghi thi.

Chrome chạy các luồng Tổng quan → Tiếp tục học, Giáo trình → Slide Viewer và Ôn tập → quay lại, câu sai và lịch ôn lặp lại, Thi thử → nộp → báo cáo → ôn câu sai, nhập JSON, sao lưu/khôi phục, F5 và hết giờ. Luồng nhập tài liệu kiểm tra PDF thực, tài liệu lỗi hoặc thiếu, phóng to, điều hướng và nguồn đã xác minh.

Để chạy lại bộ kiểm tra đã đưa vào repository, cung cấp Playwright Core, đặt `BPMS_CHROME` nếu dùng trình duyệt cài trên máy, rồi chạy `node tests/e2e/multi-tab.mjs`. Kiểm tra nâng cấp bằng `node tests/e2e/release-upgrade.mjs` yêu cầu `BPMS_RELEASE_QA` trỏ tới thư mục tạm có `old/dist/` build từ commit cũ và cặp `key.pem`, `cert.pem` của HTTPS localhost. Có thể chỉ định đường dẫn mô-đun qua `BPMS_PLAYWRIGHT_MODULE`.

Bộ kiểm tra giao diện trên Chrome và Edge có desktop, tablet và mobile, dark mode, đi theo deep link, không cuộn ngang ở màn hình đã thử, mở/đóng hộp thoại bằng bàn phím, lỗi JSON và xác nhận khôi phục. Chưa đánh giá đầy đủ bằng trình đọc màn hình hoặc thiết bị di động thật.

## 4. HTTPS, GitHub Pages, MIME và cache

- Bản RC được phục vụ cục bộ dưới `/BPS301/`; đã xác minh logo, manifest, PDF, fallback 404, khôi phục pathname/query/hash và tải lại trang con. Không có URL localhost trong HTML production.
- Yêu cầu chỉ đọc trên bản Pages hiện hành trả `200` cho trang gốc, logo, catalog, manifest và cả 11 PDF. Logo trả `image/jpeg`, JSON trả `application/json` và PDF trả `application/pdf`. GET theo byte range của PDF Lecture 1 trả `206 Partial Content`. Trang con trả HTTP 404 trước khi JavaScript của fallback chuyển tới ứng dụng. Chrome cũng đã mở được deep link Tổng quan và Giáo trình trên hosting, render PDF trang 5 và tải lại Tổng quan. Đây là bản Pages đã tồn tại trước RC.
- Các phản hồi HEAD đã kiểm tra ở hosting có `Cache-Control: max-age=600` và ETag. JS, CSS và worker được đặt tên có hash theo nội dung ở bản build; PDF và JSON dùng URL ổn định. Khoảng cache ở hosting có thể làm tệp dữ liệu cập nhật xuất hiện chậm hơn thời điểm phát hành. Không có service worker hoặc Cache Storage riêng của ứng dụng trong hồ sơ đã kiểm tra.

[Website hiện hành](https://minhnc9504.github.io/BPS301/) · [GitHub Docs về workflow Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## 5. Quyền công khai và rà soát PDF

Không tìm thấy giấy phép hoặc xác nhận quyền phân phối các PDF trong những tệp được kiểm tra. Đợt kiểm tra văn bản có nội dung trích xuất được từ 485/485 trang, không phát hiện email hay số điện thoại có tiền tố +84 theo mẫu quét, và không có trường Author/Creator được kiểm tra mang giá trị. Ba annotation đều là hyperlink tại Lecture 4 trang 8 và Lecture 7 trang 18, 36. Kết quả này không bao phủ thông tin có trong ảnh, sơ đồ, tên riêng hoặc ngữ cảnh nhạy cảm.

Cả 11 PDF đã trả phản hồi công khai từ bản Pages hiện hành. Điều này chỉ xác nhận khả năng truy cập. Chủ dự án cần rà quyền phân phối, phần hình ảnh và ba liên kết, rồi xác nhận bằng một quyết định rõ ràng trước khi tái phát hành. README mô tả rằng PDF đóng gói được đưa vào artifact và có thể tải trực tiếp nếu deploy công khai.

## 6. Cập nhật ứng dụng và sao lưu

Build commit `08d6ca5` được phục vụ trong hồ sơ tạm. Trên cả Chrome và Edge, thử tạo lượt ôn và lịch ôn, đánh dấu đã học, xác minh nguồn, nộp bài thi và nhập một PDF thật. Sau đó đóng trình duyệt, chuyển thư mục được phục vụ sang RC và mở lại cùng hồ sơ trên đúng origin HTTPS. Kết quả so sánh dữ liệu khớp, PDF từ IndexedDB mở được và trạng thái xác minh giữ qua F5.

Backup mang theo lịch sử thi, tiến độ, lịch ôn, metadata tài liệu và liên kết xác minh. Tệp nhị phân IndexedDB được xuất riêng. Backup cũ được kiểm tra ở unit test và luồng khôi phục trình duyệt. Thử trên origin khác dùng backup và tệp gốc riêng, vì localhost, HTTPS staging và Pages là các origin khác nhau.

## 7. Hiệu năng quan sát

Trung vị Chrome headless ở viewport 1440 × 960, 5 lượt local và 3 lượt hosting, mỗi lượt mở hồ sơ mới. Font tải từ xa được chặn ở cả hai nhóm. LCP local có 4 trên 5 mẫu hợp lệ. Hosting được đo trên bản đang phục vụ, và kết quả gồm chi phí mạng. Đây là số liệu lab trên máy kiểm thử, không phải số liệu trải nghiệm thực địa.

| Chỉ số | RC ở loopback | Website Pages hiện hành |
| --- | ---: | ---: |
| Từ mở Tổng quan đến khi có KPI | 273 ms | 2.823 ms |
| LCP | 240 ms | 632 ms |
| CLS quan sát | 0 | 0 |
| Tải lại Tổng quan đến khi có KPI | 151 ms | 211 ms |
| Mở và render PDF Lecture 1, trang 5 | 242 ms | 857 ms |
| Nhập tìm kiếm đến khi hiện kết quả đầu | 35 ms | 42 ms |
| JS tải vào Tổng quan, kích thước giải nén | 401.584 B | 424.480 B |
| Tổng kích thước asset có transferSize bằng 0, trong lần tải lại | 435.969 B | 144.090 B |

Chỉ số cache là kích thước tài nguyên có dấu hiệu dùng lại qua Resource Timing, không đại diện toàn bộ cache của trình duyệt. Sau bài kiểm tra nâng cấp với PDF thật 5.307.308 B, Chromium báo IndexedDB khoảng 5,31 MB và không có Cache Storage do BPMS tạo. Chuỗi giá trị localStorage trong kịch bản khoảng 6,7–7,1 kB khi ước theo UTF-16, chưa tính overhead. INP thực địa chưa được đo.

## 8. Phê duyệt, phát hành thử và rollback

1. Xem bản RC bằng `npm run check:release` rồi `npm run preview`. Chạy hồ sơ riêng để thử học, thi, backup và ghi nhiều tab. Nếu cần staging từ xa, chọn môi trường có kiểm soát truy cập. Việc công khai artifact chứa PDF cần chủ dự án phê duyệt trước.
2. Sau khi người có thẩm quyền xác nhận quyền PDF, rà review mã nguồn và cho phép Git push, đưa thay đổi qua PR vào `main`. Kiểm tra CI xanh cho SHA cần phát hành. Trong **Settings → Pages**, xác nhận nguồn là **GitHub Actions**; giới hạn môi trường `github-pages` vào nhánh được phép và bật người duyệt nếu gói GitHub hỗ trợ.
3. Sau khi được duyệt deploy, dùng **Publish approved BPMS build to GitHub Pages → Run workflow**, chọn `main`, nhập SHA đã review và bật `materials_approved`. Kiểm tra bản được phục vụ, deep link, F5, MIME/206 và mở đúng slide. Kiểm tra cập nhật trên hồ sơ thử trước khi hướng dẫn người học tải lại các tab cũ.
4. Trước khi phát hành, lưu SHA/artifact đang chạy và sao lưu tiến độ cùng các tệp nhập riêng khi cần. Nếu RC có lỗi, phát hành lại SHA đã duyệt và còn tương thích với quy trình build. Nếu SHA cũ có trước lệnh kiểm tra RC, tạo commit hoàn nguyên mã ứng dụng trên `main` qua PR, giữ workflow kiểm tra và cổng phê duyệt. Chạy lại CI rồi phát hành thủ công. Giữ nguyên URL và origin để người dùng tiếp tục đọc dữ liệu cục bộ. Chờ hết cache nếu các tệp tĩnh còn cũ.

## 9. Tệp Phase 7

- Mới: `.github/workflows/release-check.yml`, `scripts/check-release.mjs`, `tests/e2e/release-upgrade.mjs` và báo cáo này.
- Cập nhật: `.github/workflows/pages.yml`, `.github/workflows/publish-exam.yml`, `package.json`, `package-lock.json`, `README.md`, `src/App.tsx`, `src/features/DocumentUpload.tsx`.

Rủi ro còn lại gồm quyền công khai PDF, phạm vi rà soát dữ liệu nhạy cảm, cache của hosting, Firefox/Safari chưa chạy và rủi ro hai khóa localStorage khi trình duyệt bị dừng giữa lần ghi đã nêu trong Phase 6. Firefox/Safari cần được chạy thêm trước khi tuyên bố hỗ trợ những trình duyệt đó.
