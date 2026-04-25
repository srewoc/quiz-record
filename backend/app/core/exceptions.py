class AppError(Exception):
    def __init__(self, code: int, message: str, status_code: int) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


class ValidationAppError(AppError):
    def __init__(self, message: str, code: int = 4001) -> None:
        super().__init__(code=code, message=message, status_code=400)


class NotFoundError(AppError):
    def __init__(self, message: str, code: int) -> None:
        super().__init__(code=code, message=message, status_code=404)


class ConflictError(AppError):
    def __init__(self, message: str, code: int) -> None:
        super().__init__(code=code, message=message, status_code=409)


class ServiceUnavailableError(AppError):
    def __init__(self, message: str, code: int) -> None:
        super().__init__(code=code, message=message, status_code=502)
