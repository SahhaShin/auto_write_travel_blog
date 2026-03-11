package com.shincha.naverblog.model.service;

import com.shincha.naverblog.model.dao.DraftDao;
import com.shincha.naverblog.model.dao.ImageDao;
import com.shincha.naverblog.model.dto.BlogDraft;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DraftServiceImpl implements DraftService {

    private final DraftDao draftDao;
    private final ImageDao imageDao;

    @Override
    public List<BlogDraft> getAll(Long userId) {
        return draftDao.findAllByUserId(userId);
    }

    @Override
    public BlogDraft getById(Long id) {
        BlogDraft draft = draftDao.findById(id);
        if (draft != null) {
            draft.setImages(imageDao.findByDraftId(id));
        }
        return draft;
    }

    @Override
    public BlogDraft create(BlogDraft draft) {
        if (draft.getCategory() == null) draft.setCategory("여행");
        draftDao.insert(draft);
        if (draft.getImages() != null) {
            for (var image : draft.getImages()) {
                imageDao.updateDraftId(image.getId(), draft.getId());
            }
        }
        return getById(draft.getId());
    }

    @Override
    public BlogDraft update(BlogDraft draft) {
        draftDao.update(draft);
        return getById(draft.getId());
    }

    @Override
    public void delete(Long id) {
        draftDao.deleteById(id);
    }
}
