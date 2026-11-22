# Dữ liệu và sao lưu

[← Về README](../README.md)

## Phân loại dữ liệu

| Kho | Nội dung |
| --- | --- |
| Tệp tĩnh trong `public/` | Đề, lý thuyết và giáo trình đóng gói. |
| localStorage · `bps301_user_progress_v1` | Lượt trả lời, trạng thái ôn, lịch ôn, phiên và lịch sử thi, tiến độ Giáo trình, metadata và liên kết nguồn. |
| localStorage · `bps301_custom_exams_v1` | Các đề bổ sung trong trình duyệt. |
| localStorage · `smart-exam-preferences-v1` | Giao diện, phím tắt và chọn mặc định khi ôn hoặc thi. |
| IndexedDB · `bpms-document-files-v1` | Tệp PDF, PPTX, PDF xem trước và ảnh được nhập. |

Ứng dụng đọc được dữ liệu hợp lệ thuộc khóa cũ `smart-exam-v1` và chuyển sang các khóa mới khi ghi được. Dữ liệu tách theo hồ sơ trình duyệt và origin. Hai tab cùng origin phối hợp qua Web Locks và sự kiện `storage`. Khi thiếu Web Locks, ứng dụng báo chế độ chỉ đọc và vẫn cho xem học liệu hoặc xuất dữ liệu. Các tệp đã nhập có giới hạn **100 MiB mỗi tệp**. JSON có giới hạn **10 MiB** cho mỗi lần đọc và tổng nhóm tệp khi nhập qua Ngân hàng.

## Sao lưu trước khi đổi máy

1. Mở **Cài đặt & Dữ liệu → Sao lưu**. Chọn **Tất cả dữ liệu** để mang theo đề đã nhập, chỉnh sửa, cấu hình, metadata tài liệu và nguồn đã xác minh. Chọn **Chỉ tiến độ học tập** khi chỉ cần chuyển phần học và thi.
2. Mở **Giáo trình → Tệp giáo trình** và lưu các tệp đã nhập ra máy bằng nút tải tệp gốc, PDF xem trước hoặc ảnh. Bản sao JSON lưu thông tin nhận diện và liên kết, còn nhị phân của tệp trong IndexedDB đi theo bản tải riêng.
3. Ở trình duyệt đích, chọn tệp JSON và kiểm tra bản xem trước. **Gộp dữ liệu** giữ bản ghi cục bộ khi trùng ID. **Ghi đè theo phạm vi tệp** thay trạng thái được bao phủ trong bản sao và yêu cầu xác nhận.
4. Nếu thiếu tệp đã nhập, chọn **Gắn lại tệp gốc** hoặc **Gắn bản xem trước PDF**. Với nhóm ảnh, dùng lại các tệp gốc theo thứ tự ban đầu. Ứng dụng đối chiếu SHA-256 khi metadata có mã đối chiếu.

## Quyền riêng tư

BPMS lưu dữ liệu học cục bộ và dùng tệp tĩnh cho nội dung đóng gói. Phông chữ có thể được yêu cầu từ Google Fonts nếu mạng cho phép. Nếu gửi một bản sao lưu đầy đủ cho người khác, họ có thể đọc dữ liệu học và nội dung bạn tự thêm trong tệp. Khi dọn dữ liệu website hoặc chuyển hồ sơ, giữ bản sao ngoài trình duyệt để có thể phục hồi.
