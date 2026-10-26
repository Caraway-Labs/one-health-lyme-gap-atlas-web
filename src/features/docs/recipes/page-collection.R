library(httr2)
library(dplyr)

null_states <- c("MISSING", "SUPPRESSED", "UNAVAILABLE")
base_url <- sub(
  "/+$",
  "",
  Sys.getenv("ATLAS_API_BASE_URL", unset = "https://api.onehealthatlas.org")
)

retry_delay_seconds <- function(header, attempt) {
  if (!is.null(header) && nzchar(header)) {
    seconds <- suppressWarnings(as.numeric(header))
    if (!is.na(seconds) && seconds >= 0) {
      return(seconds)
    }
  }
  base <- min(60, 2^(attempt - 1))
  min(60, base + stats::runif(1, 0, min(1, base * 0.1)))
}

format_delay <- function(delay) {
  if (isTRUE(all.equal(delay, round(delay)))) {
    sprintf("%.0f", delay)
  } else {
    as.character(delay)
  }
}

format_value <- function(value) {
  if (is.null(value) || length(value) == 0 || is.na(value[[1]])) {
    return("null")
  }
  if (is.character(value)) {
    return(value[[1]])
  }
  if (isTRUE(all.equal(value, round(value)))) {
    return(sprintf("%.0f", value))
  }
  gsub("\\s+", "", jsonlite::toJSON(value[[1]], auto_unbox = TRUE, digits = 16))
}

problem_fields <- function(response) {
  if (!identical(resp_content_type(response), "application/problem+json")) {
    return(list(code = "", detail = ""))
  }
  problem <- resp_body_json(response, simplifyVector = FALSE)
  list(
    code = if (is.null(problem$code)) "" else as.character(problem$code),
    detail = if (is.null(problem$detail)) "" else as.character(problem$detail)
  )
}

atlas_get <- function(params) {
  notes <- character()
  for (attempt in seq_len(4)) {
    response <- request(paste0(base_url, "/v1/observations")) |>
      req_url_query(!!!params, .multi = "explode") |>
      req_timeout(30) |>
      req_error(is_error = function(resp) FALSE) |>
      req_perform()
    status <- resp_status(response)
    if (status %in% c(429, 503)) {
      fields <- problem_fields(response)
      delay <- retry_delay_seconds(resp_header(response, "Retry-After"), attempt)
      code_text <- if (nzchar(fields$code)) paste0(" ", fields$code) else ""
      notes <- c(
        notes,
        paste0("retry: ", status, code_text, " ", format_delay(delay))
      )
      if (attempt == 4) {
        stop(paste("Atlas HTTP", status, "after 4 attempts"))
      }
      Sys.sleep(delay)
      next
    }
    if (status >= 400) {
      fields <- problem_fields(response)
      stop(paste("Atlas HTTP", status, fields$detail))
    }
    if (!identical(resp_content_type(response), "application/json")) {
      stop(paste("Atlas Content-Type was", resp_content_type(response)))
    }
    return(list(response = response, notes = notes))
  }
  stop("Atlas retry loop ended")
}

read_rows <- function(response) {
  body <- resp_body_json(response, simplifyVector = FALSE)
  list(
    frame = bind_rows(lapply(body$data, function(item) {
      list(
        period_start = as.character(item$period_start),
        geography_id = as.character(item$geography$geography_id),
        value = format_value(item$value),
        value_state = as.character(item$value_state),
        release_id = as.character(item$release_id)
      )
    })),
    next_page_token = body$meta$next_page_token,
    release_id = as.character(body$meta$release_id)
  )
}

filters <- list(
  measure_id = "nclimgrid_tavg_county_day",
  geography_type = "county",
  geography_id = "36061",
  year = "2025",
  page_size = "2"
)
notes <- character()
frames <- list()
token <- NULL
pages <- 0
release_id <- ""
repeat {
  if (pages >= 100) {
    stop("Stopped after 100 pages because next_page_token was still set")
  }
  params <- filters
  if (!is.null(token)) {
    params$page_token <- token
  }
  result <- atlas_get(params)
  page <- read_rows(result$response)
  notes <- c(notes, result$notes)
  frames <- c(frames, list(page$frame))
  release_id <- page$release_id
  token <- page$next_page_token
  pages <- pages + 1
  if (is.null(token)) {
    break
  }
}

frame <- bind_rows(frames) |>
  mutate(
    geography_id = as.character(geography_id),
    null_state = value_state %in% null_states
  )
if (any(nchar(frame$geography_id) != 5) || any(!grepl("^[0-9]{5}$", frame$geography_id))) {
  stop("FIPS must stay a 5-character string")
}
if (any(frame$null_state & frame$value == "0")) {
  stop("null value was coerced to zero")
}
if (any(frame$null_state & frame$value != "null")) {
  stop("null value_state returned a value")
}

lines <- frame |>
  mutate(
    line = paste(period_start, geography_id, value, value_state, release_id, sep = ",")
  ) |>
  pull(line)
if (length(notes) > 0) {
  cat(paste(notes, collapse = "\n"))
  cat("\n")
}
cat(paste0("release_id: ", release_id, "\n"))
cat(paste0("pages: ", pages, "\n"))
cat("next_page_token: null\n")
cat("period_start,geography_id,value,value_state,release_id\n")
cat(paste(lines, collapse = "\n"))
cat("\n")
